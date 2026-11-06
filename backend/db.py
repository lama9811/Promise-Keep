"""Small Supabase helpers. The server uses the service_role key, so it bypasses RLS;
the browser never talks to Supabase directly."""
from functools import lru_cache

from supabase import Client, create_client

import config

TABLES = {"users", "pots", "promises", "proofs", "quizzes", "payouts"}
PHOTO_BUCKET = "proofs"


@lru_cache(maxsize=1)
def client() -> Client:
    if not config.SUPABASE_URL or not config.SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_KEY missing from backend/.env")
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


def _table(name: str):
    if name not in TABLES:
        raise ValueError(f"unknown table {name}")
    return client().table(name)


def insert(table: str, row: dict) -> dict:
    return _table(table).insert(row).execute().data[0]


def get(table: str, id: str) -> dict | None:
    rows = _table(table).select("*").eq("id", id).limit(1).execute().data
    return rows[0] if rows else None


def where(table: str, order_by: str | None = None, **filters) -> list[dict]:
    q = _table(table).select("*")
    for col, val in filters.items():
        q = q.eq(col, val)
    if order_by:
        q = q.order(order_by)
    return q.execute().data


def update(table: str, id: str, fields: dict) -> dict:
    return _table(table).update(fields).eq("id", id).execute().data[0]


def upload_photo(path: str, data: bytes, content_type: str = "image/jpeg") -> str:
    """Save a photo to the private proofs bucket. Returns the storage path.

    Use an unguessable path (e.g. f"{promise_id}/{uuid4().hex}.jpg").
    """
    client().storage.from_(PHOTO_BUCKET).upload(path, data, {"content-type": content_type})
    return path


def photo_url(path: str, expires_in: int = 600) -> str:
    """Short-lived signed URL. Only call after checking the requester may see it
    (the promise owner or a member of the same pot)."""
    res = client().storage.from_(PHOTO_BUCKET).create_signed_url(path, expires_in)
    return res.get("signedURL") or res.get("signedUrl")
