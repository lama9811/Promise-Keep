"""Connecting Strava and WHOOP (OAuth 2), and reading workouts from them.

Tokens live only in the server's `connections` table (RLS on, no browser access).
The OAuth "state" is signed with the user's id, so a callback can only finish a
connection for the person who started it.
"""
import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

import config
import db
from fitness import Activity

log = logging.getLogger("promise_keeper.connect")

PROVIDERS = {
    "strava": {
        "authorize": "https://www.strava.com/oauth/authorize",
        "token": "https://www.strava.com/oauth/token",
        "scope": "read,activity:read_all",
    },
    "whoop": {
        "authorize": "https://api.prod.whoop.com/oauth/oauth2/auth",
        "token": "https://api.prod.whoop.com/oauth/oauth2/token",
        "scope": "offline read:workout read:cycles read:recovery read:sleep",
    },
}
STATE_MAX_AGE = 15 * 60


class ConnectError(Exception):
    """Shown to the user as a short, generic message; details go to the log."""


def _creds(provider: str) -> tuple[str, str]:
    if provider == "strava":
        return config.STRAVA_CLIENT_ID, config.STRAVA_CLIENT_SECRET
    return config.WHOOP_CLIENT_ID, config.WHOOP_CLIENT_SECRET


def configured(provider: str) -> bool:
    cid, secret = _creds(provider)
    return bool(cid and secret)


def redirect_uri(provider: str) -> str:
    return f"{config.APP_URL}/connect/{provider}"


# ---------- signed state ----------

def make_state(user_id: str, provider: str, now: float | None = None) -> str:
    ts = str(int(now or time.time()))
    msg = f"{user_id}.{provider}.{ts}"
    sig = hmac.new(config.STATE_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{ts}.{sig}"


def check_state(state: str, user_id: str, provider: str, now: float | None = None) -> bool:
    try:
        ts, sig = state.split(".", 1)
        age = (now or time.time()) - int(ts)
    except (ValueError, AttributeError):
        return False
    if not 0 <= age <= STATE_MAX_AGE:
        return False
    msg = f"{user_id}.{provider}.{ts}"
    good = hmac.new(config.STATE_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(sig, good)


def authorize_url(provider: str, user_id: str) -> str:
    p = PROVIDERS[provider]
    cid, _ = _creds(provider)
    params = {
        "client_id": cid,
        "redirect_uri": redirect_uri(provider),
        "response_type": "code",
        "scope": p["scope"],
        "state": make_state(user_id, provider),
    }
    if provider == "strava":
        params["approval_prompt"] = "auto"
    return f"{p['authorize']}?{urlencode(params)}"


# ---------- tokens ----------

def _token_request(provider: str, data: dict) -> dict:
    cid, secret = _creds(provider)
    body = {"client_id": cid, "client_secret": secret, **data}
    r = httpx.post(PROVIDERS[provider]["token"], data=body, timeout=20)
    if r.status_code >= 400:
        log.warning("%s token error %s: %s", provider, r.status_code, r.text[:300])
        raise ConnectError(f"{provider} said no")
    return r.json()


def _expires(tok: dict) -> str:
    if tok.get("expires_at"):  # Strava: epoch seconds
        return datetime.fromtimestamp(int(tok["expires_at"]), timezone.utc).isoformat()
    return (datetime.now(timezone.utc) + timedelta(seconds=int(tok.get("expires_in", 3600)))).isoformat()


def finish(provider: str, user_id: str, code: str) -> dict:
    """Swap the one-time code for tokens and save the connection."""
    data = {"code": code, "grant_type": "authorization_code"}
    if provider == "whoop":
        data["redirect_uri"] = redirect_uri(provider)
    tok = _token_request(provider, data)
    external_id = None
    if provider == "strava":
        external_id = str((tok.get("athlete") or {}).get("id") or "") or None
    row = {
        "user_id": user_id,
        "provider": provider,
        "external_id": external_id,
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token"),
        "expires_at": _expires(tok),
        "scope": tok.get("scope") if isinstance(tok.get("scope"), str) else PROVIDERS[provider]["scope"],
    }
    existing = db.where("connections", user_id=user_id, provider=provider)
    if existing:
        return db.update("connections", existing[0]["id"], row)
    return db.insert("connections", row)


def access_token(conn: dict) -> str:
    """A valid access token, refreshing it first if it is about to expire."""
    exp = conn.get("expires_at")
    if exp and datetime.fromisoformat(str(exp).replace("Z", "+00:00")) > datetime.now(timezone.utc) + timedelta(minutes=2):
        return conn["access_token"]
    if not conn.get("refresh_token"):
        raise ConnectError("connection expired")
    data = {"grant_type": "refresh_token", "refresh_token": conn["refresh_token"]}
    if conn["provider"] == "whoop":
        data["scope"] = "offline"
    tok = _token_request(conn["provider"], data)
    db.update("connections", conn["id"], {
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token") or conn["refresh_token"],
        "expires_at": _expires(tok),
    })
    return tok["access_token"]


def _get(provider: str, token: str, url: str, params: dict | None = None) -> dict | list:
    r = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=20)
    if r.status_code >= 400:
        log.warning("%s GET %s -> %s: %s", provider, url, r.status_code, r.text[:300])
        raise ConnectError(f"{provider} read failed")
    return r.json()


# ---------- reading workouts ----------

def _ts(s: str) -> datetime:
    return datetime.fromisoformat(str(s).replace("Z", "+00:00"))


def strava_activities(conn: dict, since: datetime) -> list[Activity]:
    token = access_token(conn)
    out: list[Activity] = []
    for page in range(1, 4):
        items = _get("strava", token, "https://www.strava.com/api/v3/athlete/activities",
                     {"after": int(since.timestamp()), "per_page": 100, "page": page})
        for a in items:
            if a.get("manual"):
                continue  # typed in by hand, not recorded by a phone or watch: never counts
            km = round((a.get("distance") or 0) / 1000, 2)
            minutes = round((a.get("moving_time") or 0) / 60, 1)
            sport = (a.get("sport_type") or a.get("type") or "").lower()
            name = a.get("name") or sport.title() or "Strava activity"
            label = f"{name}, {km:g} km" if km else f"{name}, {minutes:g} min"
            out.append(Activity("strava", str(a["id"]), _ts(a["start_date"]), label, sport, km=km, minutes=minutes))
        if len(items) < 100:
            break
    return out


def whoop_workouts(conn: dict, since: datetime) -> list[Activity]:
    token = access_token(conn)
    out: list[Activity] = []
    params = {"start": since.isoformat().replace("+00:00", "Z"), "limit": 25}
    for _ in range(8):
        data = _get("whoop", token, "https://api.prod.whoop.com/developer/v2/activity/workout", params)
        for w in data.get("records", []):
            start, end = _ts(w["start"]), _ts(w["end"])
            minutes = round((end - start).total_seconds() / 60, 1)
            sport = (w.get("sport_name") or "").lower()
            score = w.get("score") or {}
            km = round(score["distance_meter"] / 1000, 2) if score.get("distance_meter") else None
            strain = score.get("strain")
            label = f"WHOOP {sport.title() or 'workout'}, {minutes:g} min" + (f", strain {strain:.1f}" if strain else "")
            out.append(Activity("whoop", str(w["id"]), end, label, sport, km=km, minutes=minutes))
        nxt = data.get("next_token")
        if not nxt:
            break
        params["nextToken"] = nxt
    return out


def fetch(conn: dict, since: datetime) -> list[Activity]:
    if conn["provider"] == "strava":
        return strava_activities(conn, since)
    return whoop_workouts(conn, since)
