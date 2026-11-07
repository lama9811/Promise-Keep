"""Who is asking. The browser signs in with Supabase Auth (Google or email link) and
sends its access token as `Authorization: Bearer <token>`. We ask Supabase whether the
token is real, then find or create our own `users` row for that account."""
import logging
import time

from fastapi import Header, HTTPException

import db

log = logging.getLogger("promise_keeper.auth")

_CACHE_SECONDS = 60
_cache: dict[str, tuple[float, dict]] = {}


def verify_token(token: str) -> dict | None:
    """Returns {"id", "email", "name"} for a valid Supabase access token, else None."""
    try:
        res = db.client().auth.get_user(token)
    except Exception:
        log.info("token rejected", exc_info=True)
        return None
    u = getattr(res, "user", None)
    if not u or not u.email:
        return None
    meta = u.user_metadata or {}
    name = meta.get("full_name") or meta.get("name") or u.email.split("@")[0]
    return {"id": u.id, "email": u.email.strip().lower(), "name": name[:60]}


def _account(token: str) -> dict | None:
    now = time.monotonic()
    hit = _cache.get(token)
    if hit and hit[0] > now:
        return hit[1]
    acct = verify_token(token)
    if acct:
        if len(_cache) > 1000:
            _cache.clear()
        _cache[token] = (now + _CACHE_SECONDS, acct)
    return acct


def _user_row(acct: dict) -> dict:
    found = db.where("users", auth_id=acct["id"])
    if found:
        return found[0]
    return db.insert("users", {"auth_id": acct["id"], "email": acct["email"], "name": acct["name"]})


def _bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization[7:].strip() or None


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency: the signed-in user's `users` row, or 401."""
    token = _bearer(authorization)
    acct = _account(token) if token else None
    if not acct:
        raise HTTPException(401, "Please sign in first.")
    return _user_row(acct)


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    """Like current_user, but a missing or bad token just means "not signed in"."""
    token = _bearer(authorization)
    acct = _account(token) if token else None
    return _user_row(acct) if acct else None


def owned_promise(promise_id: str, user: dict) -> dict:
    """The promise, if it belongs to this user. Someone else's promise looks like a 404."""
    promise = db.get("promises", promise_id)
    if not promise or promise["user_id"] != user["id"]:
        raise HTTPException(404, "Promise not found.")
    return promise
