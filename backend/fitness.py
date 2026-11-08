"""Fitness proof from any source: Strava, WHOOP, Apple Health (iPhone Shortcut) or a screenshot.

Every source turns into the same thing: "this activity, at this time, showed this
much" (steps, km or minutes). Code then decides if it counts:
- it happened between when the promise was made and its deadline;
- it reaches the goal (10,000 steps, 5 km, 30 minutes, or one gym session);
- the same Strava activity / WHOOP workout is never used twice;
- at most one counted proof per day, so "every day" means every day.
"""
import logging
import threading
from dataclasses import dataclass
from datetime import datetime, timezone

import db
import deals
import views

log = logging.getLogger("promise_keeper.fitness")
_lock = threading.Lock()  # syncs and uploads count one at a time, so two can't both take today's slot

# Strava sport types / WHOOP sport names that count as a gym session.
GYM_SPORTS = {
    "weighttraining", "crossfit", "workout", "highintensityintervaltraining", "elliptical", "stairstepper",
    "rowing", "virtualrow", "pilates", "yoga", "rockclimbing",
    "weightlifting", "powerlifting", "functional fitness", "strength trainer", "spin", "box fitness",
    "hiit", "stairmaster", "cycling class", "barre", "f45 training", "kickboxing", "boxing",
}
# Counts toward a distance (run) promise.
DISTANCE_SPORTS = {
    "run", "trailrun", "virtualrun", "walk", "hike", "ride", "virtualride", "ebikeride", "gravelride",
    "mountainbikeride", "swim", "running", "walking", "hiking", "cycling", "swimming", "track & field",
}
MIN_GYM_MINUTES = 20


@dataclass
class Activity:
    source: str          # strava | whoop | health | screenshot
    source_id: str | None
    at: datetime         # when it happened (UTC)
    label: str           # "Morning Run, 5.2 km"
    sport: str = ""      # lowercased sport type, if known
    steps: float | None = None
    km: float | None = None
    minutes: float | None = None
    calories: float | None = None


def value_for(promise: dict, a: Activity) -> float | None:
    """How much of this promise's goal the activity shows, or None if it doesn't apply."""
    metric = promise.get("goal_metric") or deals.GOAL_METRIC.get(promise["proof"], "minutes")
    sport = a.sport.lower()
    if metric == "steps":
        return a.steps
    if metric == "distance_km":
        if a.source in ("strava", "whoop") and sport and sport not in DISTANCE_SPORTS:
            return None
        return a.km
    if metric == "minutes":
        if promise["proof"] == "exercise" and a.source in ("strava", "whoop"):
            return None  # the Exercise ring comes from Apple Health
        return a.minutes
    if metric == "calories":
        return a.calories
    if metric == "visit":  # gym: a strength/class workout of 20+ minutes, or a gym check-in screenshot
        if a.source == "screenshot":
            return 1  # the screenshot reader already checked it shows a gym check-in
        if sport in GYM_SPORTS and (a.minutes or 0) >= MIN_GYM_MINUTES:
            return 1
        return None
    return None


def goal(promise: dict) -> float:
    metric = promise.get("goal_metric") or deals.GOAL_METRIC.get(promise["proof"], "minutes")
    return float(promise.get("goal_value") or deals.GOAL_DEFAULT.get(promise["proof"], 1)) if metric != "visit" else 1


def _day(ts) -> str:
    return views.parse_ts(ts).date().isoformat() if not isinstance(ts, datetime) else ts.date().isoformat()


def window(promise: dict) -> tuple[datetime, datetime]:
    pot = db.get("pots", promise["pot_id"])
    start = views.parse_ts(promise.get("created_at")) if promise.get("created_at") else datetime(2000, 1, 1, tzinfo=timezone.utc)
    end = views.parse_ts(pot["deadline"]) if pot else datetime.now(timezone.utc)
    return start, end


def record(promise: dict, a: Activity, ai_reason: str | None = None, confidence: float | None = None,
           photo_path: str | None = None, photo_hash: str | None = None) -> dict | None:
    """Turn one activity into a proof row (counted or not). Returns the row, or None if it was
    already recorded or doesn't apply to this promise."""
    v = value_for(promise, a)
    if v is None:
        return None
    start, end = window(promise)
    if not (start <= a.at <= end):
        return None
    with _lock:
        proofs = db.where("proofs", promise_id=promise["id"])
        if a.source_id and any(p.get("kind") == a.source and p.get("source_id") == a.source_id for p in proofs):
            return None  # already used
        need = goal(promise)
        meets = v >= need
        day_taken = any(p.get("counted") and _day(p.get("ended_at") or p["started_at"]) == _day(a.at) for p in proofs)
        counted = meets and not day_taken
        if not meets:
            reason = f"{a.label}: {_amount(promise, v)}, short of {_amount(promise, need)}."
        elif day_taken:
            reason = f"{a.label}: nice, but you already have a counted proof that day."
        else:
            reason = ai_reason or f"{a.label}: {_amount(promise, v)}. That counts."
        row = db.insert("proofs", {
            "promise_id": promise["id"],
            "kind": a.source,
            "started_at": a.at.isoformat(),
            "ended_at": a.at.isoformat(),
            "source_id": a.source_id,
            "source_label": a.label[:120],
            "metric_value": v,
            "ai_verdict": "pass" if meets else "fail",
            "ai_reason": reason[:300],
            "ai_confidence": confidence,
            "photo_path": photo_path,
            "photo_hash": photo_hash,
            "counted": counted,
        })
        if counted:
            db.update("promises", promise["id"], {"last_counted_at": datetime.now(timezone.utc).isoformat()})
        return row


def _amount(promise: dict, v: float) -> str:
    metric = promise.get("goal_metric") or deals.GOAL_METRIC.get(promise["proof"], "minutes")
    if metric == "visit":
        return "a gym session"
    return deals.goal_text(metric, v)
