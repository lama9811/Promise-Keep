"""Promise Keeper API."""
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import ai
import config
import db
import deals
import paypal

app = FastAPI(title="Promise Keeper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def parse_promise(body: ParseIn):
    tz = _tz(body.tz)
    now = datetime.now(ZoneInfo(tz))
    try:
        raw = ai.parse_promise(body.text, now, tz)
    except ai.AIError as e:
        raise HTTPException(503, f"The AI is busy, try again in a moment. ({e})")
    return deals.normalize_deal(raw, tz)


# ---------- F2: save the deal and stake with PayPal ----------

class PromiseIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    paypal_email: str
    raw_text: str = Field(min_length=3, max_length=500)
    type: str
    target_count: int = Field(ge=1, le=30)
    deadline: datetime
    stake_cents: int = Field(ge=deals.MIN_STAKE_CENTS, le=deals.MAX_STAKE_CENTS)
    recipient: str  # friend's PayPal email, or "charity"
    summary: str = ""
    gym_lat: float | None = None
    gym_lng: float | None = None

    @field_validator("type")
    @classmethod
    def _type(cls, v):
        if v not in deals.TYPES:
            raise ValueError("type must be gym, study or run")
        return v

    @field_validator("paypal_email")
    @classmethod
    def _email(cls, v):
        if not EMAIL_RE.match(v):
            raise ValueError("not an email")
        return v.strip().lower()

    @field_validator("recipient")
    @classmethod
    def _recipient(cls, v):
        v = v.strip()
        if v.lower() == "charity":
            return "charity"
        if not EMAIL_RE.match(v):
            raise ValueError('recipient must be a PayPal email or "charity"')
        return v.lower()


def _find_or_create_user(name: str, email: str) -> dict:
    found = db.where("users", paypal_email=email)
    if found:
        return found[0]
    return db.insert("users", {"name": name, "paypal_email": email})


@app.post("/promises")
def create_promise(body: PromiseIn):
    if body.deadline.tzinfo is None:
        raise HTTPException(422, "deadline needs a timezone")
    if body.deadline <= datetime.now(timezone.utc):
        raise HTTPException(422, "deadline is in the past")
    if body.type == "gym" and (body.gym_lat is None or body.gym_lng is None):
        raise HTTPException(422, "pick your gym on the map first")
    if body.recipient == body.paypal_email:
        raise HTTPException(422, "the money can't go to yourself")

    user = _find_or_create_user(body.name, body.paypal_email)
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
        "type": body.type,
        "target_count": body.target_count,
        "stake_cents": body.stake_cents,
        "recipient": body.recipient,
        "summary": body.summary,
        "gym_lat": body.gym_lat,
        "gym_lng": body.gym_lng,
        "status": "draft",
    })
    try:
        order = paypal.create_order(body.stake_cents, promise["id"])
    except paypal.PayPalError as e:
        raise HTTPException(502, f"PayPal could not create the order: {e.status}")
    db.update("promises", promise["id"], {"paypal_order_id": order["id"]})
    return {"promise_id": promise["id"], "pot_id": pot["id"], "order_id": order["id"]}


class CaptureIn(BaseModel):
    order_id: str


@app.post("/promises/{promise_id}/capture")
def capture_promise(promise_id: str, body: CaptureIn):
    promise = db.get("promises", promise_id)
    if not promise:
        raise HTTPException(404, "promise not found")
    if promise["paypal_order_id"] != body.order_id:
        raise HTTPException(400, "order does not belong to this promise")
    if promise["status"] != "draft":
        return _promise_view(promise)  # already captured: safe to call twice
    try:
        capture = paypal.capture_order(body.order_id)
    except paypal.PayPalError as e:
        raise HTTPException(502, f"PayPal could not take the payment: {e.status}")
    fields = {"paypal_capture_id": capture["id"]}
    if capture["status"] == "COMPLETED":
        fields["status"] = "active"
    promise = db.update("promises", promise_id, fields)
    return _promise_view(promise)


# ---------- Reading ----------

def _promise_view(promise: dict) -> dict:
    proofs = db.where("proofs", order_by="started_at", promise_id=promise["id"])
    done = sum(1 for p in proofs if p.get("counted"))
    pot = db.get("pots", promise["pot_id"])
    user = db.get("users", promise["user_id"])
    return {
        "id": promise["id"],
        "pot_id": promise["pot_id"],
        "name": user["name"] if user else "",
        "raw_text": promise["raw_text"],
        "summary": promise["summary"],
        "type": promise["type"],
        "target_count": promise["target_count"],
        "done_count": done,
        "stake_cents": promise["stake_cents"],
        "recipient": promise["recipient"],
        "deadline": pot["deadline"] if pot else None,
        "status": promise["status"],
        "outcome": promise.get("outcome"),
        "gym_lat": promise["gym_lat"],
        "gym_lng": promise["gym_lng"],
        "paypal_order_id": promise["paypal_order_id"],
        "paypal_capture_id": promise["paypal_capture_id"],
        "proofs": [
            {k: p.get(k) for k in ("id", "kind", "started_at", "ended_at", "ai_verdict", "ai_reason",
                                    "ai_confidence", "referee_decision", "counted")}
            for p in proofs
        ],
    }


@app.get("/promises/{promise_id}")
def get_promise(promise_id: str):
    promise = db.get("promises", promise_id)
    if not promise:
        raise HTTPException(404, "promise not found")
    return _promise_view(promise)
