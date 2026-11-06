from datetime import datetime, timedelta, timezone

import pytest

import ai
import config
import db
from tests.test_checks import jpeg
from tests.test_promises_api import promise_body

GYM = (39.3434, -76.5839)
NEAR = {"lat": 39.3440, "lng": -76.5839}  # ~67 m away
FAR = {"lat": 39.3614, "lng": -76.5839}  # ~2 km away

PASS = {"word_visible": True, "activity_matches": True, "photo_of_a_screen": False, "confidence": 0.93,
        "reason": "The word is clear and that's a gym."}


@pytest.fixture
def ai_says(monkeypatch):
    answer = {"v": dict(PASS)}
    calls = []

    def fake_check(image, mime, word, activity, proof, hint):
        calls.append((word, activity, proof))
        return answer["v"]

    monkeypatch.setattr(ai, "check_photo", fake_check)
    monkeypatch.setattr(db, "upload_photo", lambda path, data, ct="image/jpeg": path)
    answer["calls"] = calls
    return answer


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setattr(config, "DEMO_MODE", True)


@pytest.fixture
def demo_off(monkeypatch):
    monkeypatch.setattr(config, "DEMO_MODE", False)


def active(client, **over):
    c = client.post("/promises", json=promise_body(gym_lat=GYM[0], gym_lng=GYM[1], **over)).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    return c["promise_id"]


def send_photo(client, pid, proof_id, data):
    return client.post(f"/promises/{pid}/photo", data={"proof_id": proof_id}, files={"photo": ("p.jpg", data, "image/jpeg")})


def age_open_checkin(fake_db, pid, minutes):
    for p in fake_db.tables["proofs"].values():
        if p["promise_id"] == pid and not p.get("ai_verdict"):
            p["started_at"] = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


# ---------- Gym ----------

def test_checkin_from_2km_is_refused(client, demo_off):
    pid = active(client)
    r = client.post(f"/promises/{pid}/checkin/start", json=FAR)
    assert r.status_code == 422
    assert "m from your gym" in r.json()["detail"]


def test_full_gym_visit_counts_one(client, fake_db, ai_says, demo_off):
    pid = active(client)
    p = client.post(f"/promises/{pid}/checkin/start", json=NEAR).json()
    assert p["open_proof"]["kind"] == "checkin" and p["open_proof"]["word"] is None

    # Too early for the word
    r = client.post(f"/promises/{pid}/word", json=NEAR)
    assert r.status_code == 409 and "more minute" in r.json()["detail"]

    age_open_checkin(fake_db, pid, 31)
    # Walked away before finishing
    assert client.post(f"/promises/{pid}/word", json=FAR).status_code == 422

    p = client.post(f"/promises/{pid}/word", json=NEAR).json()
    word = p["open_proof"]["word"]
    assert word and word.isupper()

    r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=1)).json()
    assert (r["verdict"], r["counted"]) == ("pass", True)
    assert r["promise"]["done_count"] == 1
    assert r["promise"]["open_proof"] is None
    assert ai_says["calls"][0] == (word, "go to the gym", "gym")


def test_same_photo_twice_is_rejected(client, ai_says, demo_on):
    pid = active(client)
    for i in range(2):
        client.post(f"/promises/{pid}/checkin/start", json={"demo": True})
        p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
        r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=1)).json()
    assert r["verdict"] == "fail" and "sent this photo before" in r["reason"]
    assert r["promise"]["done_count"] == 1
    assert len(ai_says["calls"]) == 1  # the AI never saw the repeat


def test_old_photo_is_rejected(client, ai_says, demo_on):
    pid = active(client)
    client.post(f"/promises/{pid}/checkin/start", json={"demo": True})
    p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
    r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=2, exif_date=datetime(2026, 10, 1))).json()
    assert r["verdict"] == "fail" and "older" in r["reason"]


def test_demo_flag_ignored_when_server_not_in_demo_mode(client, demo_off):
    pid = active(client)
    assert client.post(f"/promises/{pid}/checkin/start", json={"demo": True}).status_code == 422


def test_expired_word_is_refused(client, fake_db, ai_says, demo_on):
    pid = active(client)
    client.post(f"/promises/{pid}/checkin/start", json={"demo": True})
    p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
    proof = fake_db.tables["proofs"][p["open_proof"]["id"]]
    proof["live_word_expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    r = send_photo(client, pid, proof["id"], jpeg(pattern=3))
    assert r.status_code == 409 and "expired" in r.json()["detail"]


# ---------- Any activity (photo proof) ----------

def test_photo_promise_flow_and_12_hour_rule(client, ai_says, demo_off):
    pid = active(client, activity="practice guitar", proof="photo", proof_hint="You holding your guitar")
    assert client.post(f"/promises/{pid}/checkin/start", json=NEAR).status_code == 400

    p = client.post(f"/promises/{pid}/word", json={}).json()
    r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=5)).json()
    assert r["counted"] is True
    assert ai_says["calls"][-1][1:] == ("practice guitar", "photo")

    r = client.post(f"/promises/{pid}/word", json={})
    assert r.status_code == 409 and "12 hours" in r.json()["detail"]


def test_unsure_goes_to_friend_and_screen_fails(client, ai_says, demo_on):
    pid = active(client, activity="cook dinner", proof="photo")
    ai_says["v"] = {**PASS, "confidence": 0.5}
    p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
    r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=6)).json()
    assert (r["verdict"], r["counted"]) == ("unsure", False)
    assert "friend will decide" in r["reason"]

    ai_says["v"] = {**PASS, "photo_of_a_screen": True}
    p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
    r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=7)).json()
    assert (r["verdict"], r["counted"]) == ("fail", False)


def test_ai_busy_keeps_word_valid(client, monkeypatch, demo_on):
    pid = active(client, activity="read", proof="photo")
    monkeypatch.setattr(db, "upload_photo", lambda *a, **k: None)

    def busy(*a):
        raise ai.AIError("503")
    monkeypatch.setattr(ai, "check_photo", busy)
    p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
    r = send_photo(client, pid, p["open_proof"]["id"], jpeg(pattern=8))
    assert r.status_code == 503
    again = client.get(f"/promises/{pid}").json()
    assert again["open_proof"]["word"] == p["open_proof"]["word"]


def test_not_a_photo_and_inactive_promise(client, ai_says, fake_paypal, demo_on):
    pid = active(client, activity="read", proof="photo")
    p = client.post(f"/promises/{pid}/word", json={"demo": True}).json()
    assert send_photo(client, pid, p["open_proof"]["id"], b"hello").status_code == 422

    fake_paypal.capture_status = "PENDING"
    c = client.post("/promises", json=promise_body(activity="read", proof="photo", gym_lat=None, gym_lng=None)).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    assert client.post(f"/promises/{c['promise_id']}/word", json={}).status_code == 409


def test_friend_and_quiz_promises_dont_use_photos(client, demo_on):
    pid = active(client, activity="stay off instagram", proof="friend")
    assert client.post(f"/promises/{pid}/word", json={"demo": True}).status_code == 400
