"""Turn the AI's deal into safe, validated values. The AI suggests; code decides."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# How a promise gets proven:
#   gym    - location check + 30 minutes on site + live-word photo
#   quiz   - AI quiz on a photo of your own notes (studying)
#   photo  - live-word photo of you doing the activity (anything you can photograph)
#   friend - your friend confirms it (things a photo can't show, like "no social media")
PROOFS = {"gym", "quiz", "photo", "friend"}
MIN_STAKE_CENTS = 100
MAX_STAKE_CENTS = 10_000
MAX_ACTIVITY_LEN = 80
GYM_HINT = "You at your gym, holding up the secret word."


def usd_to_cents(usd: float) -> int:
    return int(round(float(usd) * 100))


def normalize_deal(raw: dict, tz: str, now: datetime | None = None) -> dict:
    """Clean the AI output. Adds a clarification question if something is off."""
    now = now or datetime.now(timezone.utc)
    problems: list[str] = []

    activity = " ".join(str(raw.get("activity") or "").split())[:MAX_ACTIVITY_LEN]
    if not activity:
        problems.append("What do you want to do?")

    proof = str(raw.get("proof", "")).lower().strip()
    if proof not in PROOFS:
        proof = "photo"

    count = int(raw.get("target_count") or 0)
    if not 1 <= count <= 30:
        problems.append("How many times do you want to do it?")
        count = max(1, min(count, 30))

    stake_cents = usd_to_cents(raw.get("stake_usd") or 0)
    if not MIN_STAKE_CENTS <= stake_cents <= MAX_STAKE_CENTS:
        problems.append("How much do you want to stake? Pick between $1 and $100.")
        stake_cents = max(MIN_STAKE_CENTS, min(stake_cents, MAX_STAKE_CENTS))

    try:
        deadline = datetime.fromisoformat(str(raw.get("deadline")))
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=ZoneInfo(tz))
    except (TypeError, ValueError):
        deadline = None
    if deadline is None or deadline <= now:
        problems.append("When is the deadline?")

    clarification = raw.get("needs_clarification") or (problems[0] if problems else None)
    return {
        "activity": activity,
        "proof": proof,
        "proof_hint": GYM_HINT if proof == "gym" else str(raw.get("proof_hint") or "").strip(),
        "target_count": count,
        "deadline": deadline.isoformat() if deadline else None,
        "stake_cents": stake_cents,
        "recipient": str(raw.get("recipient") or "charity").strip(),
        "summary": str(raw.get("summary") or "").strip(),
        "needs_clarification": clarification,
    }
