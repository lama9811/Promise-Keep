from datetime import datetime, timedelta, timezone

import ai
import deals

FUTURE = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()


def promise_body(**over):
    body = {
        "name": "Sam",
        "paypal_email": "Sam@Example.com",
        "raw_text": "gym 3x this week or $20 to Alex",
        "type": "gym",
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
        "type": "gym", "target_count": 3, "deadline": FUTURE, "stake_usd": 20.0,
        "recipient": "Alex", "summary": "Gym 3x", "needs_clarification": None,
    })
    r = client.post("/promises/parse", json={"text": "gym 3x this week or $20 to Alex", "tz": "America/New_York"})
    assert r.status_code == 200
    d = r.json()
    assert (d["type"], d["target_count"], d["stake_cents"], d["recipient"]) == ("gym", 3, 2000, "Alex")
    assert d["needs_clarification"] is None


def test_parse_ai_down_returns_503(client, monkeypatch):
    def boom(*a):
        raise ai.AIError("overloaded")
    monkeypatch.setattr(ai, "parse_promise", boom)
    assert client.post("/promises/parse", json={"text": "gym 3x"}).status_code == 503


def test_normalize_flags_bad_values():
    now = datetime.now(timezone.utc)
    d = deals.normalize_deal({"type": "swim", "target_count": 0, "stake_usd": 500,
                              "deadline": "2000-01-01T00:00:00+00:00"}, "UTC", now)
    assert d["needs_clarification"]
    assert d["stake_cents"] == deals.MAX_STAKE_CENTS
    assert d["target_count"] == 1
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
    # The user's email is stored lowercase, and reused next time.
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
    assert client.post("/promises", json=promise_body(gym_lat=None)).status_code == 422
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert client.post("/promises", json=promise_body(deadline=past)).status_code == 422
    assert client.post("/promises", json=promise_body(type="study", gym_lat=None, gym_lng=None,
                                                     recipient="charity")).status_code == 200


def test_unknown_promise_is_404(client):
    assert client.get("/promises/not-a-uuid").status_code == 404


# ---------- Security ----------

def test_payer_identity_comes_from_paypal(client, fake_db, fake_paypal):
    """Someone types another person's email; PayPal says who really paid."""
    fake_paypal.payer_email = "Real.Payer@example.com"
    c = client.post("/promises", json=promise_body(paypal_email="victim@example.com")).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    promise = fake_db.get("promises", c["promise_id"])
    owner = fake_db.get("users", promise["user_id"])
    assert owner["paypal_email"] == "real.payer@example.com"


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
