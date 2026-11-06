"""Turn the AI's deal into safe, validated values. The AI suggests; code decides."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

TYPES = {"gym", "study", "run"}
MIN_STAKE_CENTS = 100
MAX_STAKE_CENTS = 10_000


def usd_to_cents(usd: float) -> int:
    return int(round(float(usd) * 100))


def normalize_deal(raw: dict, tz: str, now: datetime | None = None) -> dict:
    """Clean the AI output. Adds a clarification question if something is off."""
    now = now or datetime.now(timezone.utc)
    problems: list[str] = []

    kind = str(raw.get("type", "")).lower().strip()
    if kind not in TYPES:
        problems.append("Is this a gym, study or run goal?")
        kind = "gym"

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
        "type": kind,
        "target_count": count,
        "deadline": deadline.isoformat() if deadline else None,
        "stake_cents": stake_cents,
        "recipient": str(raw.get("recipient") or "charity").strip(),
        "summary": str(raw.get("summary") or "").strip(),
        "needs_clarification": clarification,
    }
