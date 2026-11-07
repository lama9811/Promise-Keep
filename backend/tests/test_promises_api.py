from datetime import datetime, timedelta, timezone

import ai
import deals

FUTURE = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()


def promise_body(**over):
    body = {
        "name": "Sam",
        "raw_text": "gym 3x this week or $20 to Alex",
        "activity": "go to the gym",
        "proof": "gym",
        "target_count": 3,
        "deadline": FUTURE,
        "stake_cents": 2000,
        "recipient": "alex@example.com",
        "summary": "Gym 3 times",
        "gym_lat": 39.34,
        "gym_lng": -76.58,
    }
    body.update(over)
    return body


# ---------- F1 ----------

def test_parse_returns_cents_and_card(client, monkeypatch):
    monkeypatch.setattr(ai, "parse_promise", lambda text, now, tz: {
        "activity": "go to the gym", "proof": "gym", "proof_hint": "x", "target_count": 3, "deadline": FUTURE, "stake_usd": 20.0,
        "recipient": "Alex", "summary": "Gym 3x", "needs_clarification": None,
    })
    r = client.post("/promises/parse", json={"text": "gym 3x this week or $20 to Alex", "tz": "America/New_York"})
    assert r.status_code == 200
    d = r.json()
    assert (d["activity"], d["proof"], d["target_count"], d["stake_cents"], d["recipient"]) == ("go to the gym", "gym", 3, 2000, "Alex")
    assert d["needs_clarification"] is None


def test_parse_ai_down_returns_503(client, monkeypatch):
    def boom(*a):
        raise ai.AIError("overloaded")
    monkeypatch.setattr(ai, "parse_promise", boom)
    assert client.post("/promises/parse", json={"text": "gym 3x"}).status_code == 503


def test_normalize_flags_bad_values():
    now = datetime.now(timezone.utc)
    d = deals.normalize_deal({"activity": "", "proof": "telepathy", "target_count": 0, "stake_usd": 500,
                              "deadline": "2000-01-01T00:00:00+00:00"}, "UTC", now)
    assert d["needs_clarification"]
    assert d["stake_cents"] == deals.MAX_STAKE_CENTS
    assert d["target_count"] == 1
    assert d["proof"] == "workout"  # not fitness: falls back to a workout and asks
    assert "fitness" in d["needs_clarification"] or d["needs_clarification"]
    assert (d["goal_metric"], d["goal_value"]) == ("minutes", 30)
    steps = deals.normalize_deal({"activity": "walk", "proof": "steps", "goal_value": 9_999_999, "target_count": 7,
                                  "stake_usd": 20, "deadline": "2099-01-01T00:00:00+00:00"}, "UTC", now)
    assert (steps["goal_metric"], steps["goal_value"]) == ("steps", 100_000)  # clamped
    run = deals.normalize_deal({"activity": "run", "proof": "run", "goal_value": 5.04, "target_count": 3,
                                "stake_usd": 20, "deadline": "2099-01-01T00:00:00+00:00"}, "UTC", now)
    assert (run["goal_metric"], run["goal_value"]) == ("distance_km", 5.0)
    assert deals.goal_text("steps", 10000) == "10,000 steps"
    assert deals.usd_to_cents(19.99) == 1999
    assert deals.usd_to_cents(0.1 + 0.2) == 30


# ---------- F2 ----------

def test_create_then_capture_makes_promise_active(client, fake_db, fake_paypal):
    r = client.post("/promises", json=promise_body())
    assert r.status_code == 200, r.text
    created = r.json()
    assert fake_paypal.orders == [(2000, created["promise_id"])]

    p = client.get(f"/promises/{created['promise_id']}").json()
    assert (p["status"], p["done_count"], p["target_count"]) == ("draft", 0, 3)

    r = client.post(f"/promises/{created['promise_id']}/capture", json={"order_id": created["order_id"]})
    assert r.status_code == 200
    p = r.json()
    assert p["status"] == "active"
    assert p["paypal_capture_id"] == f"CAP-{created['order_id']}"
    # One users row per signed-in account, reused next time.
    assert len(fake_db.tables["users"]) == 1
    client.post("/promises", json=promise_body())
    assert len(fake_db.tables["users"]) == 1


def test_pending_capture_does_not_activate(client, fake_paypal):
    fake_paypal.capture_status = "PENDING"
    c = client.post("/promises", json=promise_body()).json()
    p = client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]}).json()
    assert p["status"] == "draft"


def test_capture_rejects_wrong_order(client):
    c = client.post("/promises", json=promise_body()).json()
    r = client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": "SOMEONE-ELSES"})
    assert r.status_code == 400


def test_capture_twice_is_safe(client, fake_paypal):
    c = client.post("/promises", json=promise_body()).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    fake_paypal.capture_order = lambda o: (_ for _ in ()).throw(AssertionError("captured twice"))
    r = client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    assert r.json()["status"] == "active"


def test_create_validation(client):
    assert client.post("/promises", json=promise_body(stake_cents=50)).status_code == 422
    assert client.post("/promises", json=promise_body(recipient="Alex")).status_code == 422
    assert client.post("/promises", json=promise_body(recipient="sam@example.com")).status_code == 422
    assert client.post("/promises", json=promise_body(proof="photo", gym_lat=None, gym_lng=None)).status_code == 422  # not fitness
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert client.post("/promises", json=promise_body(deadline=past)).status_code == 422
    assert client.post("/promises", json=promise_body(proof="telepathy")).status_code == 422
    assert client.post("/promises", json=promise_body(activity="walk 10,000 steps", proof="steps", gym_lat=None, gym_lng=None,
                                                     recipient="charity")).status_code == 200
    # A gym promise without a map pin is fine: it can be proven with WHOOP or a screenshot.
    assert client.post("/promises", json=promise_body(gym_lat=None, gym_lng=None)).status_code == 200


def test_unknown_promise_is_404(client):
    assert client.get("/promises/not-a-uuid").status_code == 404


# ---------- Security ----------

def test_payer_identity_comes_from_paypal(client, fake_db, fake_paypal):
    """The money goes back to the PayPal account that actually paid."""
    fake_paypal.payer_email = "Real.Payer@example.com"
    c = client.post("/promises", json=promise_body(paypal_email="victim@example.com")).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    promise = fake_db.get("promises", c["promise_id"])
    assert promise["payer_email"] == "real.payer@example.com"
    owner = fake_db.get("users", promise["user_id"])
    assert owner["email"] == "sam@example.com"  # still Sam's promise


def test_signed_out_can_only_look(anon, client):
    c = client.post("/promises", json=promise_body()).json()
    pid = c["promise_id"]
    assert anon.post("/promises/parse", json={"text": "gym 3x"}).status_code == 401
    assert anon.post("/promises", json=promise_body()).status_code == 401
    assert anon.post(f"/promises/{pid}/capture", json={"order_id": c["order_id"]}).status_code == 401
    assert anon.post(f"/promises/{pid}/word", json={}).status_code == 401
    assert anon.get("/me/promises").status_code == 401
    bad = anon.get("/me", headers={"Authorization": "Bearer forged"})
    assert bad.status_code == 401
    view = anon.get(f"/promises/{pid}")
    assert view.status_code == 200 and view.json()["is_mine"] is False
    assert client.get(f"/promises/{pid}").json()["is_mine"] is True


def test_someone_else_cannot_capture_or_prove(client, fake_paypal):
    from tests.conftest import as_user
    c = client.post("/promises", json=promise_body()).json()
    pid = c["promise_id"]
    mallory = as_user("mallory")
    assert client.post(f"/promises/{pid}/capture", json={"order_id": c["order_id"]}, headers=mallory).status_code == 404
    client.post(f"/promises/{pid}/capture", json={"order_id": c["order_id"]})
    assert client.post(f"/promises/{pid}/word", json={"demo": True}, headers=mallory).status_code == 404
    assert client.post(f"/promises/{pid}/checkin/start", json={"demo": True}, headers=mallory).status_code == 404


def test_my_promises_lists_only_mine_and_skips_drafts(client):
    from tests.conftest import as_user
    mine = client.post("/promises", json=promise_body()).json()
    client.post(f"/promises/{mine['promise_id']}/capture", json={"order_id": mine["order_id"]})
    client.post("/promises", json=promise_body())  # never paid: a draft
    theirs = client.post("/promises", json=promise_body(recipient="sam@example.com"), headers=as_user("alex")).json()
    client.post(f"/promises/{theirs['promise_id']}/capture", json={"order_id": theirs["order_id"]}, headers=as_user("alex"))

    cards = client.get("/me/promises").json()
    assert [card["id"] for card in cards] == [mine["promise_id"]]
    assert cards[0]["done_count"] == 0 and cards[0]["stake_cents"] == 2000
    assert "gym_lat" not in cards[0]
    assert client.get("/me").json() == {"name": "Sam", "email": "sam@example.com"}


def test_public_view_hides_location_and_masks_emails(client):
    c = client.post("/promises", json=promise_body()).json()
    p = client.get(f"/promises/{c['promise_id']}").json()
    assert "gym_lat" not in p and "gym_lng" not in p
    assert p["has_gym"] is True
    assert p["recipient"] == "alex…@example.com"


def test_ai_error_details_not_leaked(client, monkeypatch):
    def boom(*a):
        raise ai.AIError("secret internal detail")
    monkeypatch.setattr(ai, "parse_promise", boom)
    r = client.post("/promises/parse", json={"text": "gym 3x"})
    assert "secret internal detail" not in r.text


def test_fitness_promises_save_their_goal(client, fake_db):
    c = client.post("/promises", json=promise_body(
        activity="do yoga for 45 minutes", proof="workout", goal_value=45, proof_hint="You on your mat", gym_lat=None, gym_lng=None,
    )).json()
    p = client.get(f"/promises/{c['promise_id']}").json()
    assert (p["proof"], p["goal_metric"], p["goal_value"], p["has_gym"]) == ("workout", "minutes", 45, False)
    c = client.post("/promises", json=promise_body(activity="walk", proof="steps", gym_lat=None, gym_lng=None)).json()
    p = client.get(f"/promises/{c['promise_id']}").json()
    assert (p["goal_metric"], p["goal_value"]) == ("steps", 10_000)  # default when not given


def test_gym_hint_is_fixed_and_coords_dropped_for_non_gym(client, fake_db):
    c = client.post("/promises", json=promise_body(proof_hint="anything")).json()
    assert fake_db.get("promises", c["promise_id"])["proof_hint"] == deals.GYM_HINT
    c = client.post("/promises", json=promise_body(activity="walk", proof="steps")).json()
    assert fake_db.get("promises", c["promise_id"])["gym_lat"] is None
