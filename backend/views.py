"""What the browser is allowed to see. Anyone with a promise link (its UUID) can
view it, so views leave out gym coordinates, mask emails, and never include photo
hashes or quiz answers. Only the signed-in owner can prove it (`is_mine`). PayPal IDs stay: judges
should see that money moved."""
from datetime import datetime, timedelta, timezone

import checks
import db


def mask_email(value: str | None) -> str | None:
    """sb-pdq7b53766632@personal.example.com -> sb-p…@personal.example.com"""
    if not value or "@" not in value:
        return value
    local, domain = value.split("@", 1)
    return f"{local[:4]}…@{domain}"


def parse_ts(value) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def open_proof(proofs: list[dict]) -> dict | None:
    """The proof in progress (checked in, or word issued but no photo yet), if any."""
    now = datetime.now(timezone.utc)
    for p in reversed(proofs):
        if p.get("ai_verdict") or p.get("ended_at"):
            continue
        started = parse_ts(p["started_at"])
        if now - started > timedelta(hours=4):
            continue  # abandoned
        word_expires = parse_ts(p.get("live_word_expires_at"))
        word_live = bool(p.get("live_word")) and word_expires and word_expires > now
        if p.get("live_word") and not word_live:
            continue  # word ran out: start again
        return {
            "id": p["id"],
            "kind": p["kind"],
            "started_at": started.isoformat(),
            "ready_at": (started + timedelta(minutes=checks.MIN_VISIT_MINUTES)).isoformat()
            if p["kind"] == "checkin"
            else started.isoformat(),
            "word": p.get("live_word") if word_live else None,
            "word_expires_at": word_expires.isoformat() if word_live else None,
        }
    return None


def promise_card(promise: dict) -> dict:
    """The short version for the "Your promises" list on the dashboard."""
    proofs = db.where("proofs", promise_id=promise["id"])
    pot = db.get("pots", promise["pot_id"])
    return {
        "id": promise["id"],
        "summary": promise["summary"] or promise["raw_text"],
        "activity": promise["activity"],
        "proof": promise["proof"],
        "goal_metric": promise.get("goal_metric"),
        "goal_value": promise.get("goal_value"),
        "target_count": promise["target_count"],
        "done_count": sum(1 for p in proofs if p.get("counted")),
        "stake_cents": promise["stake_cents"],
        "deadline": pot["deadline"] if pot else None,
        "status": promise["status"],
        "outcome": promise.get("outcome"),
        "recipient": mask_email(promise["recipient"]),
        "created_at": str(promise["created_at"]) if promise.get("created_at") else None,
    }


def promise_view(promise: dict, viewer: dict | None = None) -> dict:
    proofs = db.where("proofs", order_by="started_at", promise_id=promise["id"])
    done = sum(1 for p in proofs if p.get("counted"))
    pot = db.get("pots", promise["pot_id"])
    user = db.get("users", promise["user_id"])
    return {
        "id": promise["id"],
        "is_mine": bool(viewer and viewer["id"] == promise["user_id"]),
        "pot_id": promise["pot_id"],
        "name": user["name"] if user else "",
        "raw_text": promise["raw_text"],
        "summary": promise["summary"],
        "activity": promise["activity"],
        "proof": promise["proof"],
        "proof_hint": promise.get("proof_hint"),
        "goal_metric": promise.get("goal_metric"),
        "goal_value": promise.get("goal_value"),
        "target_count": promise["target_count"],
        "done_count": done,
        "stake_cents": promise["stake_cents"],
        "recipient": mask_email(promise["recipient"]),
        "deadline": pot["deadline"] if pot else None,
        "status": promise["status"],
        "outcome": promise.get("outcome"),
        "has_gym": promise["gym_lat"] is not None,
        "paypal_order_id": promise["paypal_order_id"],
        "paypal_capture_id": promise["paypal_capture_id"],
        "open_proof": open_proof(proofs),
        "agent_note": promise.get("agent_note"),
        "agent_summary": (pot or {}).get("agent_summary"),
        "settled_at": str(pot["settled_at"]) if pot and pot.get("settled_at") else None,
        "money_moves": [
            {
                "kind": m["kind"],
                "amount_cents": m["amount_cents"],
                "to": mask_email(m["receiver"]),
                "paypal_id": m.get("paypal_id"),
                "status": m.get("status"),
                "mine": m.get("promise_id") == promise["id"],
            }
            for m in (db.where("payouts", pot_id=promise["pot_id"]) if pot and pot.get("settled_at") else [])
        ],
        "proofs": [
            {k: p.get(k) for k in ("id", "kind", "started_at", "ended_at", "ai_verdict", "ai_reason",
                                    "ai_confidence", "referee_decision", "counted", "metric_value", "source_label")}
            for p in proofs
            if p.get("ai_verdict")
        ],
    }
