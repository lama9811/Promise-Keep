"""Proving a promise (PRD F3, F4, generalized to any activity).

Flow for gym promises:
  1. POST /promises/{id}/checkin/start   "I'm here": location must be within 150 m.
  2. POST /promises/{id}/word            "I'm done": 30 minutes passed, still on site.
                                         Issues a fresh live word, valid 10 minutes.
  3. POST /promises/{id}/photo           Live photo holding the word: code checks, then AI.

Flow for photo promises (guitar, cooking, running...): step 2 then step 3.
Quiz (study) and friend promises are proven elsewhere.

Order of checks (PRD): cheap code checks first, then the AI, then a human friend if
the AI is unsure. The AI always gives a reason, and the user sees it.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

import ai
import checks
import config
import db
import views
import words

router = APIRouter()
log = logging.getLogger("promise_keeper.proofs")

MAX_PHOTO_BYTES = 8 * 1024 * 1024
MIN_HOURS_BETWEEN_COUNTED = 12
CONFIDENCE_FOR_PASS = 0.7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _demo(requested: bool) -> bool:
    """Demo shortcuts (fake location, no 30-minute wait) only when the server allows it."""
    return bool(requested and config.DEMO_MODE)


def _active_promise(promise_id: str) -> dict:
    promise = db.get("promises", promise_id)
    if not promise:
        raise HTTPException(404, "Promise not found.")
    if promise["status"] != "active":
        raise HTTPException(409, "This promise isn't active, so it can't take proof right now.")
    pot = db.get("pots", promise["pot_id"])
    if pot and views.parse_ts(pot["deadline"]) <= _now():
        raise HTTPException(409, "The deadline has passed. Proof is closed for this promise.")
    return promise


def _check_location(promise: dict, lat: float | None, lng: float | None, demo: bool, moment: str):
    if demo:
        return
    if lat is None or lng is None:
        raise HTTPException(422, "We need your location for a gym check-in. Allow location access and try again.")
    dist = checks.distance_m(promise["gym_lat"], promise["gym_lng"], lat, lng)
    if dist > checks.GYM_RADIUS_M:
        raise HTTPException(
            422,
            f"You're about {dist:,.0f} m from your gym. {moment} only works within {checks.GYM_RADIUS_M} m.",
        )


def _recently_counted(promise_id: str) -> bool:
    cutoff = _now() - timedelta(hours=MIN_HOURS_BETWEEN_COUNTED)
    return any(
        p.get("counted") and views.parse_ts(p.get("ended_at") or p["started_at"]) > cutoff
        for p in db.where("proofs", promise_id=promise_id)
    )


class Where(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    demo: bool = False


# ---------- 1. "I'm here" (gym only) ----------

@router.post("/promises/{promise_id}/checkin/start")
def checkin_start(promise_id: str, body: Where):
    promise = _active_promise(promise_id)
    if promise["proof"] != "gym":
        raise HTTPException(400, "Only gym promises use check-in.")
    demo = _demo(body.demo)
    if _recently_counted(promise_id) and not demo:
        raise HTTPException(409, f"You already have a counted visit in the last {MIN_HOURS_BETWEEN_COUNTED} hours. Come back later.")

    existing = views.open_proof(db.where("proofs", order_by="started_at", promise_id=promise_id))
    if existing and existing["kind"] == "checkin":
        return views.promise_view(promise)  # already checked in: safe to tap twice

    _check_location(promise, body.lat, body.lng, demo, "Check-in")
    started = _now() - (timedelta(minutes=checks.MIN_VISIT_MINUTES) if demo else timedelta(0))
    db.insert("proofs", {
        "promise_id": promise_id,
        "kind": "checkin",
        "started_at": started.isoformat(),
        "lat": body.lat,
        "lng": body.lng,
    })
    return views.promise_view(promise)


# ---------- 2. Issue a live word ----------

@router.post("/promises/{promise_id}/word")
def issue_word(promise_id: str, body: Where):
    promise = _active_promise(promise_id)
    demo = _demo(body.demo)
    proofs = db.where("proofs", order_by="started_at", promise_id=promise_id)
    open_ = views.open_proof(proofs)
    expires = (_now() + timedelta(minutes=checks.LIVE_WORD_MINUTES)).isoformat()
    last_word = next((p.get("live_word") for p in reversed(proofs) if p.get("live_word")), None)

    if promise["proof"] == "gym":
        if not open_ or open_["kind"] != "checkin":
            raise HTTPException(409, "Tap \"I'm here\" when you arrive at your gym first.")
        ready_at = views.parse_ts(open_["ready_at"])
        if _now() < ready_at and not demo:
            mins = int((ready_at - _now()).total_seconds() // 60) + 1
            raise HTTPException(409, f"Stay a bit longer: {mins} more minute{'s' if mins != 1 else ''} until your visit counts.")
        _check_location(promise, body.lat, body.lng, demo, "Finishing")
        if open_["word"]:
            return views.promise_view(promise)
        db.update("proofs", open_["id"], {"live_word": words.pick(avoid=last_word), "live_word_expires_at": expires})
        return views.promise_view(promise)

    if promise["proof"] == "photo":
        if _recently_counted(promise_id) and not demo:
            raise HTTPException(409, f"You already have a counted proof in the last {MIN_HOURS_BETWEEN_COUNTED} hours. Come back later.")
        if open_ and open_["word"]:
            return views.promise_view(promise)
        db.insert("proofs", {
            "promise_id": promise_id,
            "kind": "photo",
            "started_at": _now().isoformat(),
            "live_word": words.pick(avoid=last_word),
            "live_word_expires_at": expires,
        })
        return views.promise_view(promise)

    raise HTTPException(400, "This promise is proven another way, not with a photo.")


# ---------- 3. The live photo ----------

def _user_photo_hashes(user_id: str) -> list[str]:
    hashes = []
    for pr in db.where("promises", user_id=user_id):
        hashes += [p["photo_hash"] for p in db.where("proofs", promise_id=pr["id"]) if p.get("photo_hash")]
    return hashes


def _decide(v: dict) -> tuple[str, bool]:
    """(verdict, counted) from the AI's answer. Under 0.7 confidence goes to the friend."""
    if v["photo_of_a_screen"]:
        return "fail", False
    passed = v["word_visible"] and v["activity_matches"]
    if v["confidence"] < CONFIDENCE_FOR_PASS and (passed or v["word_visible"]):
        return "unsure", False
    return ("pass", True) if passed else ("fail", False)


# Plain `def` on purpose: FastAPI runs it in a worker thread, so the slow AI call and
# upload never block other requests.
@router.post("/promises/{promise_id}/photo")
def submit_photo(promise_id: str, proof_id: str = Form(...), photo: UploadFile = File(...)):
    promise = _active_promise(promise_id)
    proof = db.get("proofs", proof_id)
    if not proof or proof["promise_id"] != promise_id:
        raise HTTPException(404, "That check-in wasn't found. Start again.")
    if proof.get("ai_verdict"):
        raise HTTPException(409, "This proof was already judged.")
    expires = views.parse_ts(proof.get("live_word_expires_at"))
    if not proof.get("live_word") or not expires:
        raise HTTPException(409, "Get your secret word first.")
    if expires <= _now():
        raise HTTPException(409, "Your secret word expired. Get a new one and take the photo within 10 minutes.")

    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "That photo is too large. Try again.")
    mime = photo.content_type if photo.content_type in ("image/jpeg", "image/png", "image/webp") else "image/jpeg"

    photo_hash = checks.photo_hash(data)
    if not photo_hash:
        raise HTTPException(422, "That file isn't a photo.")

    def finish(verdict: str, reason: str, counted: bool, confidence: float | None = None, path: str | None = None):
        # 1. Write the verdict exactly once (atomic: only if no verdict yet), not counted yet.
        written = db.update_if_null("proofs", proof_id, {
            "ended_at": _now().isoformat(),
            "photo_hash": photo_hash,
            "photo_path": path,
            "ai_verdict": verdict,
            "ai_reason": reason,
            "ai_confidence": confidence,
            "counted": False,
        }, null_column="ai_verdict")
        if written is None:
            raise HTTPException(409, "This proof was already judged.")
        # 2. Count it only if the promise's 12-hour slot can be claimed (atomic compare-and-set).
        if counted:
            now = _now()
            window = timedelta(0) if config.DEMO_MODE else timedelta(hours=MIN_HOURS_BETWEEN_COUNTED)
            if db.claim_count(promise_id, now.isoformat(), (now - window).isoformat()):
                db.update("proofs", proof_id, {"counted": True})
            else:
                counted = False
                verdict = "fail"
                reason = f"You already have a counted proof in the last {MIN_HOURS_BETWEEN_COUNTED} hours."
                db.update("proofs", proof_id, {"ai_verdict": verdict, "ai_reason": reason})
        view = views.promise_view(promise)
        return {"verdict": verdict, "reason": reason, "counted": counted, "promise": view}

    # Code checks first: they are free and can't be talked around.
    if checks.is_duplicate(photo_hash, _user_photo_hashes(promise["user_id"])):
        return finish("fail", "You've sent this photo before. Take a new one.", False)
    date_problem = checks.photo_date_problem(data, views.parse_ts(proof["started_at"]))
    if date_problem:
        return finish("fail", date_problem, False)

    path = f"{promise_id}/{uuid.uuid4().hex}.jpg"
    try:
        db.upload_photo(path, data, mime)
    except Exception:
        log.exception("photo upload failed")
        path = None

    try:
        v = ai.check_photo(data, mime, proof["live_word"], promise["activity"], promise["proof"], promise.get("proof_hint") or "")
    except ai.AIError:
        log.exception("photo check failed")
        raise HTTPException(503, "The AI referee is busy. Your word is still valid, so try sending the photo again.")

    verdict, counted = _decide(v)
    reason = v["reason"]
    if verdict == "unsure":
        reason = f"{reason} Your friend will decide this one."
    return finish(verdict, reason, counted, round(float(v["confidence"]), 2), path)
