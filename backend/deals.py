"""Turn the AI's deal into safe, validated values. The AI suggests; code decides."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Promise Keeper is about fitness. How a promise gets proven:
#   gym     - a gym visit: location check + 30 minutes on site + live-word photo,
#             or a WHOOP workout / gym-app check-in screenshot
#   steps   - a daily step goal: Apple Health via the iPhone Shortcut, or a screenshot
#   run     - a distance goal (run, walk, ride): Strava, or a screenshot of the workout
#   workout - any workout of at least N minutes: WHOOP, Strava, or a screenshot
PROOFS = {"gym", "steps", "run", "workout"}
LEGACY_PROOFS = {"photo", "quiz", "friend"}  # older promises still load; new ones can't use them

# What one "time" means, per proof type, and sensible limits.
GOAL_METRIC = {"gym": "visit", "steps": "steps", "run": "distance_km", "workout": "minutes"}
GOAL_DEFAULT = {"gym": 1, "steps": 10_000, "run": 5, "workout": 30}
GOAL_RANGE = {"steps": (500, 100_000), "distance_km": (0.5, 200), "minutes": (5, 600), "visit": (1, 1)}
MIN_STAKE_CENTS = 100
MAX_STAKE_CENTS = 10_000
MAX_ACTIVITY_LEN = 80
GYM_HINT = "You at your gym, holding up the secret word."


def clamp_goal(metric: str, value) -> float:
    """Keep the goal inside sane limits; steps and minutes are whole numbers."""
    lo, hi = GOAL_RANGE[metric]
    try:
        v = float(value)
    except (TypeError, ValueError):
        v = lo
    v = max(lo, min(v, hi))
    return round(v, 1) if metric == "distance_km" else int(round(v))


def goal_text(metric: str | None, value) -> str:
    """10000 steps -> '10,000 steps'; 5 km -> '5 km'."""
    if metric == "steps":
        return f"{int(value):,} steps"
    if metric == "distance_km":
        return f"{float(value):g} km"
    if metric == "minutes":
        return f"{int(value)} minutes"
    return "a gym visit"


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
        proof = "workout"
        problems.append("Promise Keeper is for fitness. Try steps, a run, a workout or the gym.")
    metric = GOAL_METRIC[proof]
    goal = clamp_goal(metric, raw.get("goal_value") or GOAL_DEFAULT[proof])

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
        "goal_metric": metric,
        "goal_value": goal,
        "proof_hint": GYM_HINT if proof == "gym" else str(raw.get("proof_hint") or "").strip(),
        "target_count": count,
        "deadline": deadline.isoformat() if deadline else None,
        "stake_cents": stake_cents,
        "recipient": str(raw.get("recipient") or "charity").strip(),
        "summary": str(raw.get("summary") or "").strip(),
        "needs_clarification": clarification,
    }
