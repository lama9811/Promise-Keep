"""Promise Keeper API."""
import asyncio
import hmac
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import agent
import ai
import auth
import config
import db
import deals
import paypal
import views
from fitness_routes import router as fitness_router
from proof_routes import router as proof_router

log = logging.getLogger("promise_keeper")


async def _agent_loop():
    """While the server runs, the agent checks for passed deadlines every minute."""
    while True:
        await asyncio.sleep(config.AGENT_INTERVAL_SECONDS)
        try:
            await asyncio.to_thread(agent.run_due)
        except Exception:
            log.exception("agent run failed")


@asynccontextmanager
async def lifespan(_app):
    task = asyncio.create_task(_agent_loop()) if config.AGENT_INTERVAL_SECONDS > 0 else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Promise Keeper", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(proof_router)
app.include_router(fitness_router)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _tz(name: str) -> str:
    try:
        ZoneInfo(name)
        return name
    except (ZoneInfoNotFoundError, ValueError):
        return "UTC"


@app.get("/health")
def health():
    return {"status": "ok", "demo_mode": config.DEMO_MODE}


# ---------- F1: read a promise ----------

class ParseIn(BaseModel):
    text: str = Field(min_length=3, max_length=500)
    tz: str = "UTC"


@app.post("/promises/parse")
def parse_promise(body: ParseIn, user: dict = Depends(auth.current_user)):
    tz = _tz(body.tz)
    now = datetime.now(ZoneInfo(tz))
    try:
        raw = ai.parse_promise(body.text, now, tz)
    except ai.AIError:
        log.exception("promise parse failed")
        raise HTTPException(503, "The AI is busy, try again in a moment.")
    return deals.normalize_deal(raw, tz)


# ---------- F2: save the deal and stake with PayPal ----------

class PromiseIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    raw_text: str = Field(min_length=3, max_length=500)
    activity: str = Field(min_length=2, max_length=deals.MAX_ACTIVITY_LEN)
    proof: str
    proof_hint: str = Field(default="", max_length=200)
    target_count: int = Field(ge=1, le=30)
    deadline: datetime
    stake_cents: int = Field(ge=deals.MIN_STAKE_CENTS, le=deals.MAX_STAKE_CENTS)
    recipient: str  # the friend's PayPal email
    summary: str = ""
    goal_value: float | None = None  # 10000 steps, 5 km, 30 minutes; ignored for gym
    gym_lat: float | None = None
    gym_lng: float | None = None

    @field_validator("proof")
    @classmethod
    def _proof(cls, v):
        if v not in deals.PROOFS:
            raise ValueError("proof must be gym, steps, run or workout")
        return v

    @field_validator("recipient")
    @classmethod
    def _recipient(cls, v):
        v = v.strip()
        if not EMAIL_RE.match(v):
            raise ValueError("recipient must be your friend's PayPal email")
        return v.lower()


@app.post("/promises")
def create_promise(body: PromiseIn, user: dict = Depends(auth.current_user)):
    if body.deadline.tzinfo is None:
        raise HTTPException(422, "deadline needs a timezone")
    if body.deadline <= datetime.now(timezone.utc):
        raise HTTPException(422, "deadline is in the past")
    if body.recipient == user["email"]:
        raise HTTPException(422, "the money can't go to yourself")

    if body.name.strip() != user["name"]:
        user = db.update("users", user["id"], {"name": body.name.strip()})
    pot = db.insert("pots", {
        "name": body.summary or body.raw_text[:60],
        "created_by": user["id"],
        "deadline": body.deadline.isoformat(),
        "recipient": body.recipient,
    })
    promise = db.insert("promises", {
        "pot_id": pot["id"],
        "user_id": user["id"],
        "raw_text": body.raw_text,
        "activity": body.activity,
        "proof": body.proof,
        "proof_hint": deals.GYM_HINT if body.proof == "gym" else body.proof_hint,
        "goal_metric": deals.GOAL_METRIC[body.proof],
        "goal_value": deals.clamp_goal(deals.GOAL_METRIC[body.proof], body.goal_value or deals.GOAL_DEFAULT[body.proof]),
        "target_count": body.target_count,
        "stake_cents": body.stake_cents,
        "recipient": body.recipient,
        "summary": body.summary,
        "gym_lat": body.gym_lat if body.proof == "gym" else None,
        "gym_lng": body.gym_lng if body.proof == "gym" else None,
        "status": "draft",
    })
    try:
        order = paypal.create_order(body.stake_cents, promise["id"])
    except paypal.PayPalError:
        log.exception("create_order failed")
        raise HTTPException(502, "PayPal could not create the order. Please try again.")
    db.update("promises", promise["id"], {"paypal_order_id": order["id"]})
    return {"promise_id": promise["id"], "pot_id": pot["id"], "order_id": order["id"]}


class CaptureIn(BaseModel):
    order_id: str


@app.post("/promises/{promise_id}/capture")
def capture_promise(promise_id: str, body: CaptureIn, user: dict = Depends(auth.current_user)):
    promise = auth.owned_promise(promise_id, user)
    if promise["paypal_order_id"] != body.order_id:
        raise HTTPException(400, "order does not belong to this promise")
    if promise["status"] != "draft":
        return views.promise_view(promise, user)  # already captured: safe to call twice
    try:
        capture = paypal.capture_order(body.order_id)
    except paypal.PayPalError:
        log.exception("capture_order failed")
        raise HTTPException(502, "PayPal could not take the payment. Please try again.")
    fields = {"paypal_capture_id": capture["id"]}
    # Money goes back to the PayPal account that actually paid, not a typed email.
    payer_email = (capture.get("payer_email") or "").strip().lower()
    if payer_email:
        fields["payer_email"] = payer_email
    if capture["status"] == "COMPLETED":
        fields["status"] = "active"
    promise = db.update("promises", promise_id, fields)
    return views.promise_view(promise, user)


# ---------- Reading ----------

@app.get("/me")
def me(user: dict = Depends(auth.current_user)):
    return {"name": user["name"], "email": user["email"]}


@app.get("/me/promises")
def my_promises(user: dict = Depends(auth.current_user)):
    """Newest first. Unpaid drafts are left out: they never got locked in."""
    rows = [p for p in db.where("promises", user_id=user["id"]) if p["status"] != "draft"]
    rows.sort(key=lambda p: str(p.get("created_at") or ""), reverse=True)
    return [views.promise_card(p) for p in rows]


# ---------- The promise agent ----------

@app.post("/agent/run")
def run_agent(x_agent_key: str | None = Header(default=None)):
    """For a cron job (Render): settle every pot whose deadline has passed."""
    if not config.AGENT_KEY or not x_agent_key or not hmac.compare_digest(x_agent_key, config.AGENT_KEY):
        raise HTTPException(404, "not found")
    return agent.run_due()


@app.get("/me/agent")
def my_agent(user: dict = Depends(auth.current_user)):
    """What the agent is watching for this person, and what it did on their pots."""
    mine = [p for p in db.where("promises", user_id=user["id"]) if p["status"] != "draft"]
    pot_ids = list({p["pot_id"] for p in mine})
    by_promise = {p["id"]: p for p in mine}
    pots = [db.get("pots", pid) for pid in pot_ids]
    open_pots = [p for p in pots if p and not p.get("settled_at")]
    deadlines = sorted(str(p["deadline"]) for p in open_pots)
    events = [
        {
            "id": e["id"],
            "kind": e["kind"],
            "message": e["message"],
            "at": str(e["created_at"]),
            "promise_id": e.get("promise_id") if e.get("promise_id") in by_promise else None,
            "pot_id": e["pot_id"],
        }
        for e in db.recent_events(pot_ids)
    ]
    return {
        "watching": len(open_pots),
        "next_deadline": deadlines[0] if deadlines else None,
        "interval_seconds": config.AGENT_INTERVAL_SECONDS,
        "last_run_at": agent.last_run["at"],
        "events": events,
    }


@app.get("/promises/{promise_id}")
def get_promise(promise_id: str, user: dict | None = Depends(auth.optional_user)):
    """Anyone with the link can look. Only the owner gets `is_mine` (and the Prove panel)."""
    promise = db.get("promises", promise_id)
    if not promise:
        raise HTTPException(404, "promise not found")
    return views.promise_view(promise, user)
