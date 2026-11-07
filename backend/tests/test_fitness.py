"""Fitness proof: Strava / WHOOP sync, the iPhone Shortcut, screenshots, and the counting rules."""
import io
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image, ImageDraw

import agent
import ai
import config
import connect
import db
import fitness
from fitness import Activity
from tests.conftest import as_user
from tests.test_promises_api import promise_body

NOW = datetime.now(timezone.utc)


def active(client, fake_db, fake_paypal, **over):
    fake_paypal.payer_email = "sam@personal.example.com"
    body = promise_body(**{"gym_lat": None, "gym_lng": None, **over})
    c = client.post("/promises", json=body).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    # Made an hour ago, so activities from "now" fall inside its window.
    fake_db.tables["promises"][c["promise_id"]]["created_at"] = (NOW - timedelta(hours=1)).isoformat()
    return fake_db.tables["promises"][c["promise_id"]]


def png(seed: int) -> bytes:
    img = Image.new("RGB", (120, 200), (seed * 37 % 255, 200, 255 - seed * 11 % 255))
    d = ImageDraw.Draw(img)
    for i in range(seed % 7 + 3):
        d.rectangle([10 + i * 12, 190 - (seed * (i + 3)) % 150, 18 + i * 12, 190], fill=(seed * 7 % 255, 40, 40))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


# ---------- counting rules ----------

def test_a_run_counts_only_if_it_reaches_the_distance(client, fake_db, fake_paypal):
    p = active(client, fake_db, fake_paypal, activity="run 5 km", proof="run", goal_value=5, target_count=3)
    short = fitness.record(p, Activity("strava", "1", NOW, "Easy jog, 3.1 km", "run", km=3.1, minutes=20))
    assert short["counted"] is False and "short of 5 km" in short["ai_reason"]
    good = fitness.record(p, Activity("strava", "2", NOW, "Long run, 6.2 km", "run", km=6.2, minutes=35))
    assert good["counted"] is True


def test_one_counted_proof_per_day_and_no_reuse(client, fake_db, fake_paypal):
    p = active(client, fake_db, fake_paypal, activity="walk", proof="steps", goal_value=10000, target_count=7)
    first = fitness.record(p, Activity("health", "h1", NOW, "Apple Health", steps=12000))
    again = fitness.record(p, Activity("health", "h1", NOW, "Apple Health", steps=12000))
    second = fitness.record(p, Activity("health", "h2", NOW, "Apple Health", steps=15000))
    assert first["counted"] is True
    assert again is None  # same source, ignored
    assert second["counted"] is False and "already" in second["ai_reason"]


def test_activities_outside_the_promise_window_are_ignored(client, fake_db, fake_paypal):
    p = active(client, fake_db, fake_paypal, activity="run", proof="run", goal_value=5)
    before = Activity("strava", "old", NOW - timedelta(days=3), "Old run", "run", km=10)
    assert fitness.record(p, before) is None


def test_gym_promise_counts_strength_workouts_not_a_walk(client, fake_db, fake_paypal):
    p = active(client, fake_db, fake_paypal)  # gym, 3 times
    assert fitness.value_for(p, Activity("whoop", "w1", NOW, "WHOOP", "weightlifting", minutes=50)) == 1
    assert fitness.value_for(p, Activity("whoop", "w2", NOW, "WHOOP", "weightlifting", minutes=10)) is None
    assert fitness.value_for(p, Activity("strava", "s1", NOW, "Walk", "walk", km=3, minutes=40)) is None


def test_distance_promise_ignores_non_distance_sports(client, fake_db, fake_paypal):
    p = active(client, fake_db, fake_paypal, activity="run", proof="run", goal_value=5)
    assert fitness.value_for(p, Activity("strava", "1", NOW, "Lift", "weighttraining", km=8)) is None
    assert fitness.value_for(p, Activity("strava", "2", NOW, "Ride", "ride", km=8)) == 8


# ---------- Strava / WHOOP ----------

def test_connect_start_needs_keys_and_state_is_signed(client, monkeypatch):
    monkeypatch.setattr(config, "STRAVA_CLIENT_ID", "")
    assert client.post("/connect/strava/start").status_code == 503
    monkeypatch.setattr(config, "STRAVA_CLIENT_ID", "123")
    monkeypatch.setattr(config, "STRAVA_CLIENT_SECRET", "s")
    url = client.post("/connect/strava/start").json()["url"]
    assert url.startswith("https://www.strava.com/oauth/authorize") and "activity%3Aread_all" in url

    state = connect.make_state("user-a", "strava")
    assert connect.check_state(state, "user-a", "strava")
    assert not connect.check_state(state, "user-b", "strava")  # someone else can't finish it
    assert not connect.check_state(state, "user-a", "whoop")
    assert not connect.check_state(state, "user-a", "strava", now=datetime.now().timestamp() + 3600)


def test_finish_rejects_a_bad_state(client, monkeypatch):
    monkeypatch.setattr(config, "WHOOP_CLIENT_ID", "1")
    monkeypatch.setattr(config, "WHOOP_CLIENT_SECRET", "2")
    r = client.post("/connect/whoop/finish", json={"code": "abcd", "state": "123.bad"})
    assert r.status_code == 400


def test_connected_strava_runs_count_automatically(client, fake_db, fake_paypal, monkeypatch):
    p = active(client, fake_db, fake_paypal, activity="run 5 km", proof="run", goal_value=5, target_count=2)
    fake_db.insert("connections", {"user_id": p["user_id"], "provider": "strava", "access_token": "t"})
    runs = [
        Activity("strava", "a1", NOW - timedelta(minutes=30), "Morning Run, 5.4 km", "run", km=5.4, minutes=28),
        Activity("strava", "a2", NOW - timedelta(minutes=20), "Bike, 20 km", "weighttraining", km=20, minutes=60),
    ]
    monkeypatch.setattr(connect, "fetch", lambda conn, since: runs)

    r = client.post(f"/promises/{p['id']}/sync").json()
    assert r["new_proofs"] == 1
    assert r["promise"]["done_count"] == 1
    assert r["promise"]["proofs"][0]["source_label"] == "Morning Run, 5.4 km"
    # Syncing again doesn't double count.
    assert client.post(f"/promises/{p['id']}/sync").json()["new_proofs"] == 0
    conns = client.get("/me/connections").json()["providers"]
    assert [c["connected"] for c in conns] == [True, False]


def test_agent_pulls_a_last_minute_workout_before_settling(client, fake_db, fake_paypal, monkeypatch):
    p = active(client, fake_db, fake_paypal, activity="work out", proof="workout", goal_value=30, target_count=1)
    fake_db.insert("connections", {"user_id": p["user_id"], "provider": "whoop", "access_token": "t"})
    deadline = NOW - timedelta(minutes=5)
    fake_db.tables["pots"][p["pot_id"]]["deadline"] = deadline.isoformat()
    workout = Activity("whoop", "w9", deadline - timedelta(minutes=2), "WHOOP Hiit, 40 min", "hiit", minutes=40)
    monkeypatch.setattr(connect, "fetch", lambda conn, since: [workout])

    assert agent.run_due(use_model=False)["settled"] == 1
    assert len(fake_paypal.refunds) == 1  # the late workout counted, so the stake came back
    assert fake_db.tables["promises"][p["id"]]["outcome"] == "won"


# ---------- iPhone Shortcut ----------

def test_shortcut_sends_today_steps(client, fake_db, fake_paypal, anon):
    p = active(client, fake_db, fake_paypal, activity="walk", proof="steps", goal_value=10000, target_count=7)
    key = client.post("/me/shortcut-key").json()["key"]
    assert key.startswith("pk_")
    assert client.get("/me/connections").json()["shortcut"] is True

    low = anon.post("/shortcut/steps", json={"steps": 6200}, headers={"X-Shortcut-Key": key}).json()
    assert low["results"][0]["counted"] is False and "short of 10,000 steps" in low["message"]
    ok = anon.post("/shortcut/steps", json={"steps": 10432}, headers={"X-Shortcut-Key": key}).json()
    assert ok["results"][0]["counted"] is True
    assert db.get("promises", p["id"])  # still there
    assert client.get(f"/promises/{p['id']}").json()["done_count"] == 1


def test_shortcut_rejects_bad_keys_and_old_dates(client, fake_db, fake_paypal, anon):
    active(client, fake_db, fake_paypal, activity="walk", proof="steps")
    key = client.post("/me/shortcut-key").json()["key"]
    assert anon.post("/shortcut/steps", json={"steps": 20000}).status_code == 401
    assert anon.post("/shortcut/steps", json={"steps": 20000}, headers={"X-Shortcut-Key": "pk_nope"}).status_code == 401
    old = (NOW - timedelta(days=5)).date().isoformat()
    assert anon.post("/shortcut/steps", json={"steps": 20000, "date": old}, headers={"X-Shortcut-Key": key}).status_code == 422
    # A new key replaces the old one.
    client.post("/me/shortcut-key")
    assert anon.post("/shortcut/steps", json={"steps": 20000}, headers={"X-Shortcut-Key": key}).status_code == 401


# ---------- screenshots ----------

@pytest.fixture
def reads(monkeypatch):
    """Set what the AI 'reads' from the next screenshot."""
    box = {}

    def fake_read(image, mime, goal, activity, today):
        return {"app": "Apple Health", "shows": "steps", "steps": None, "distance_km": None, "minutes": None,
                "date_shown": None, "says_today": True, "looks_edited": False, "confidence": 0.95,
                "reason": "Clear step count for today.", **box}

    monkeypatch.setattr(ai, "read_fitness_screenshot", fake_read)
    monkeypatch.setattr(db, "upload_photo", lambda path, data, ct="image/png": path)
    return box


def shot(client, pid, seed):
    return client.post(f"/promises/{pid}/screenshot", data={"tz": "UTC"},
                       files={"screenshot": ("s.png", png(seed), "image/png")}).json()


def test_screenshot_with_enough_steps_counts(client, fake_db, fake_paypal, reads):
    p = active(client, fake_db, fake_paypal, activity="walk", proof="steps", goal_value=10000, target_count=7)
    reads.update(steps=10482)
    r = shot(client, p["id"], 1)
    assert r["counted"] is True and "Apple Health" in r["reason"]
    assert r["promise"]["proofs"][-1]["metric_value"] == 10482


def test_screenshot_rules(client, fake_db, fake_paypal, reads):
    p = active(client, fake_db, fake_paypal, activity="walk", proof="steps", goal_value=10000, target_count=7)
    reads.update(steps=4000)
    assert "short of 10,000" in shot(client, p["id"], 2)["reason"]
    reads.update(steps=20000, looks_edited=True)
    assert "edited" in shot(client, p["id"], 3)["reason"]
    reads.update(looks_edited=False, says_today=False, date_shown="2026-01-02")
    assert "from 2026-01-02" in shot(client, p["id"], 4)["reason"]
    reads.update(says_today=True, date_shown=None, confidence=0.4)
    assert "couldn't read it clearly" in shot(client, p["id"], 5)["reason"]
    reads.update(confidence=0.95, steps=None)
    assert "couldn't find a step count" in shot(client, p["id"], 6)["reason"]
    reads.update(steps=12000)
    assert shot(client, p["id"], 7)["counted"] is True
    # The exact same picture again is refused.
    assert "already sent this screenshot" in shot(client, p["id"], 7)["reason"]
    assert client.get(f"/promises/{p['id']}").json()["done_count"] == 1


def test_gym_screenshot_must_be_a_check_in(client, fake_db, fake_paypal, reads):
    p = active(client, fake_db, fake_paypal)  # gym
    reads.update(shows="steps", steps=9000)
    assert "doesn't look like a gym check-in" in shot(client, p["id"], 8)["reason"]
    reads.update(shows="gym_checkin", app="Planet Fitness")
    r = shot(client, p["id"], 9)
    assert r["counted"] is True and "Planet Fitness" in r["reason"]


def test_only_the_owner_can_send_proof(client, fake_db, fake_paypal, reads):
    p = active(client, fake_db, fake_paypal, activity="walk", proof="steps")
    r = client.post(f"/promises/{p['id']}/screenshot", headers=as_user("mallory"),
                    files={"screenshot": ("s.png", png(11), "image/png")})
    assert r.status_code == 404
    assert client.post(f"/promises/{p['id']}/sync", headers=as_user("mallory")).status_code == 404
