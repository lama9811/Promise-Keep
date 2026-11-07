"""Fitness proof routes: connect Strava / WHOOP, sync workouts, the iPhone Shortcut
for Apple Health steps, and screenshot uploads read by Gemini."""
import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

import ai
import auth
import checks
import connect
import db
import deals
import fitness
import views
from fitness import Activity

router = APIRouter()
log = logging.getLogger("promise_keeper.fitness_routes")

MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024
SCREENSHOT_CONFIDENCE = 0.7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _open_promise(promise_id: str, user: dict) -> dict:
    promise = auth.owned_promise(promise_id, user)
    if promise["status"] != "active":
        raise HTTPException(409, "This promise isn't active, so it can't take proof right now.")
    pot = db.get("pots", promise["pot_id"])
    if pot and views.parse_ts(pot["deadline"]) <= _now():
        raise HTTPException(409, "The deadline has passed. Proof is closed for this promise.")
    return promise


# ---------- Connections ----------

@router.get("/me/connections")
def my_connections(user: dict = Depends(auth.current_user)):
    rows = {c["provider"]: c for c in db.where("connections", user_id=user["id"])}
    return {
        "providers": [
            {
                "provider": p,
                "available": connect.configured(p),
                "connected": p in rows,
                "last_synced_at": str(rows[p]["last_synced_at"]) if p in rows and rows[p].get("last_synced_at") else None,
            }
            for p in ("strava", "whoop")
        ],
        "shortcut": bool(user.get("shortcut_key_hash")),
    }


def _provider(provider: str) -> str:
    if provider not in connect.PROVIDERS:
        raise HTTPException(404, "not found")
    if not connect.configured(provider):
        raise HTTPException(503, f"{provider.title()} isn't set up on this server yet.")
    return provider


@router.post("/connect/{provider}/start")
def connect_start(provider: str, user: dict = Depends(auth.current_user)):
    return {"url": connect.authorize_url(_provider(provider), user["id"])}


class FinishIn(BaseModel):
    code: str = Field(min_length=4, max_length=512)
    state: str = Field(min_length=4, max_length=200)


@router.post("/connect/{provider}/finish")
def connect_finish(provider: str, body: FinishIn, user: dict = Depends(auth.current_user)):
    provider = _provider(provider)
    if not connect.check_state(body.state, user["id"], provider):
        raise HTTPException(400, "That connect link expired. Start again from your account page.")
    try:
        connect.finish(provider, user["id"], body.code)
    except connect.ConnectError:
        raise HTTPException(502, f"{provider.title()} didn't accept the connection. Try again.")
    synced = sync_user(user["id"])
    return {"connected": True, "new_proofs": synced}


@router.delete("/connect/{provider}")
def disconnect(provider: str, user: dict = Depends(auth.current_user)):
    if provider not in connect.PROVIDERS:
        raise HTTPException(404, "not found")
    for c in db.where("connections", user_id=user["id"], provider=provider):
        db.delete("connections", c["id"])
    return {"connected": False}


# ---------- Sync ----------

def sync_promise(promise: dict, conns: list[dict] | None = None) -> int:
    """Pull workouts from the owner's connected apps into this promise. Returns new proofs."""
    if promise["status"] != "active" or promise["proof"] == "steps":
        return 0  # steps come from Apple Health (Shortcut) or screenshots
    conns = conns if conns is not None else db.where("connections", user_id=promise["user_id"])
    start, _ = fitness.window(promise)
    new = 0
    for conn in conns:
        try:
            acts = connect.fetch(conn, start - timedelta(hours=1))
        except connect.ConnectError:
            log.info("sync failed for %s %s", conn["provider"], promise["id"])
            continue
        for a in sorted(acts, key=lambda x: x.at):
            if fitness.record(promise, a):
                new += 1
        db.update("connections", conn["id"], {"last_synced_at": _now().isoformat()})
    return new


def sync_promise_for_settle(promise: dict) -> int:
    """Same as sync_promise; activities are still limited to before the deadline by fitness.record."""
    return sync_promise(promise)


def sync_user(user_id: str) -> int:
    conns = db.where("connections", user_id=user_id)
    if not conns:
        return 0
    return sum(sync_promise(p, conns) for p in db.where("promises", user_id=user_id) if p["status"] == "active")


def sync_all_active() -> int:
    """For the agent: refresh every active promise whose owner connected an app."""
    total = 0
    by_user: dict[str, list[dict]] = {}
    for c in db.where("connections"):
        by_user.setdefault(c["user_id"], []).append(c)
    for user_id, conns in by_user.items():
        for p in db.where("promises", user_id=user_id):
            if p["status"] == "active":
                total += sync_promise(p, conns)
    return total


@router.post("/promises/{promise_id}/sync")
def sync_now(promise_id: str, user: dict = Depends(auth.current_user)):
    promise = _open_promise(promise_id, user)
    new = sync_promise(promise)
    return {"new_proofs": new, "promise": views.promise_view(db.get("promises", promise_id), user)}


# ---------- Apple Health via the iPhone Shortcut ----------

def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@router.post("/me/shortcut-key")
def new_shortcut_key(user: dict = Depends(auth.current_user)):
    """A fresh personal key for the iPhone Shortcut. Shown once; only its hash is kept."""
    key = "pk_" + secrets.token_urlsafe(24)
    db.update("users", user["id"], {"shortcut_key_hash": _hash_key(key)})
    return {"key": key}


class StepsIn(BaseModel):
    steps: float = Field(ge=0, le=200_000)
    date: str | None = None  # YYYY-MM-DD on the phone; defaults to today (UTC)


@router.post("/shortcut/steps")
def shortcut_steps(body: StepsIn, x_shortcut_key: str | None = Header(default=None)):
    if not x_shortcut_key or not x_shortcut_key.startswith("pk_"):
        raise HTTPException(401, "Missing your Promise Keeper key. Copy it again from your account page.")
    users = db.where("users", shortcut_key_hash=_hash_key(x_shortcut_key))
    if not users or not hmac.compare_digest(users[0]["shortcut_key_hash"], _hash_key(x_shortcut_key)):
        raise HTTPException(401, "That key doesn't match. Make a new one on your account page.")
    user = users[0]
    now = _now()
    day = now.date().isoformat()
    if body.date:
        try:
            d = datetime.fromisoformat(body.date[:10]).date()
        except ValueError:
            raise HTTPException(422, "The date should look like 2026-11-07.")
        if abs((d - now.date()).days) > 1:
            raise HTTPException(422, "Only today's steps can be sent.")
        day = d.isoformat()
    steps = int(body.steps)
    results = []
    for p in db.where("promises", user_id=user["id"]):
        if p["status"] != "active" or p["proof"] != "steps":
            continue
        pot = db.get("pots", p["pot_id"])
        if pot and views.parse_ts(pot["deadline"]) <= now:
            continue
        row = fitness.record(p, Activity("health", f"health-{day}-{steps}", now, f"Apple Health, {steps:,} steps", steps=steps))
        if row:
            results.append({"promise": p["summary"] or p["activity"], "counted": row["counted"], "reason": row["ai_reason"]})
    if not results:
        return {"message": "Got it, but you have no active step promise right now.", "results": []}
    counted = sum(1 for r in results if r["counted"])
    msg = f"{steps:,} steps sent. " + (f"Counted for {counted} promise{'s' if counted != 1 else ''}." if counted else results[0]["reason"])
    return {"message": msg, "results": results}


# ---------- Screenshots read by Gemini ----------

def _today(tz: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz))
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now(timezone.utc)


def _fail(promise: dict, reason: str, path: str | None, phash: str | None, confidence: float | None = None) -> dict:
    return db.insert("proofs", {
        "promise_id": promise["id"], "kind": "screenshot",
        "started_at": _now().isoformat(), "ended_at": _now().isoformat(),
        "ai_verdict": "fail", "ai_reason": reason[:300], "ai_confidence": confidence,
        "photo_path": path, "photo_hash": phash, "counted": False,
    })


def _user_hashes(user_id: str) -> list[str]:
    out = []
    for pr in db.where("promises", user_id=user_id):
        out += [p["photo_hash"] for p in db.where("proofs", promise_id=pr["id"]) if p.get("photo_hash")]
    return out


# Plain `def`: FastAPI runs it in a worker thread, so the AI call never blocks other requests.
@router.post("/promises/{promise_id}/screenshot")
def submit_screenshot(
    promise_id: str,
    screenshot: UploadFile = File(...),
    tz: str = Form("UTC"),
    user: dict = Depends(auth.current_user),
):
    promise = _open_promise(promise_id, user)
    data = screenshot.file.read(MAX_SCREENSHOT_BYTES + 1)
    if len(data) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(413, "That screenshot is too large. Try again.")
    mime = screenshot.content_type if screenshot.content_type in ("image/jpeg", "image/png", "image/webp") else "image/png"
    phash = checks.photo_hash(data)
    if not phash:
        raise HTTPException(422, "That file isn't a picture. Upload a screenshot.")

    def verdict(row: dict) -> dict:
        return {"counted": row["counted"], "reason": row["ai_reason"], "promise": views.promise_view(db.get("promises", promise_id), user)}

    if checks.is_duplicate(phash, _user_hashes(user["id"])):
        return verdict(_fail(promise, "You've already sent this screenshot. Send today's.", None, phash))

    metric = promise.get("goal_metric") or deals.GOAL_METRIC[promise["proof"]]
    goal = deals.goal_text(metric, promise.get("goal_value") or deals.GOAL_DEFAULT[promise["proof"]])
    today = _today(tz)
    try:
        r = ai.read_fitness_screenshot(data, mime, goal, promise["activity"], today)
    except ai.AIError:
        log.exception("screenshot read failed")
        raise HTTPException(503, "The AI is busy. Your screenshot wasn't used, so send it again in a moment.")

    path = None
    try:
        path = db.upload_photo(f"{promise_id}/{uuid.uuid4().hex}.{mime.split('/')[1]}", data, mime)
    except Exception:
        log.exception("screenshot upload failed")

    today_s = today.date().isoformat()
    yesterday_s = (today.date() - timedelta(days=1)).isoformat()
    shown = (r.get("date_shown") or "")[:10]
    is_today = r["says_today"] or shown == today_s
    if shown and shown not in (today_s, yesterday_s) and not r["says_today"]:
        return verdict(_fail(promise, f"This screenshot is from {shown}. Send one from today.", path, phash, r["confidence"]))
    if not is_today:
        return verdict(_fail(promise, "We couldn't see that this is from today. Use a screen that says Today or shows the date.", path, phash, r["confidence"]))
    if r["looks_edited"]:
        return verdict(_fail(promise, "This screenshot looks edited, so it doesn't count.", path, phash, r["confidence"]))
    if r["confidence"] < SCREENSHOT_CONFIDENCE:
        return verdict(_fail(promise, f"The AI couldn't read it clearly. {r['reason']}", path, phash, r["confidence"]))

    app = (r.get("app") or "Screenshot")[:40]
    if metric == "visit":
        if r["shows"] != "gym_checkin":
            return verdict(_fail(promise, "That doesn't look like a gym check-in. Send your gym app's check-in screen.", path, phash, r["confidence"]))
        a = Activity("screenshot", f"shot-{phash}", _now(), f"{app} gym check-in")
    else:
        a = Activity("screenshot", f"shot-{phash}", _now(), app, steps=r.get("steps"), km=r.get("distance_km"), minutes=r.get("minutes"))
        if fitness.value_for(promise, a) is None:
            want = {"steps": "a step count", "distance_km": "a distance", "minutes": "a workout time"}[metric]
            return verdict(_fail(promise, f"We couldn't find {want} on this screenshot.", path, phash, r["confidence"]))
    row = fitness.record(promise, a, ai_reason=f"{app}: {r['reason']}", confidence=r["confidence"], photo_path=path, photo_hash=phash)
    if not row:
        return verdict(_fail(promise, "This doesn't fit the dates of your promise.", path, phash, r["confidence"]))
    return verdict(row)
