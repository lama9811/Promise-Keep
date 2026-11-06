"""Gemini calls. Every call uses JSON mode with a schema, so replies always parse.

If the main model is overloaded (503) or rate-limited (429), we back off and
try the GEMINI_FALLBACK_MODELS in order.
"""
import json
import time
from datetime import datetime
from functools import lru_cache

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

import config


class AIError(Exception):
    pass


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    if not config.GEMINI_API_KEY:
        raise AIError("GEMINI_API_KEY missing from backend/.env")
    # JSON mode needs v1beta; without pinning, some requests were sent to v1 and failed.
    return genai.Client(api_key=config.GEMINI_API_KEY, http_options=types.HttpOptions(api_version="v1beta"))


def generate_json(prompt: str, schema: type[BaseModel], images: list[tuple[bytes, str]] | None = None) -> dict:
    """Run a prompt (plus optional images as (bytes, mime)) and return parsed JSON."""
    parts: list = [types.Part.from_bytes(data=b, mime_type=m) for b, m in (images or [])]
    parts.append(prompt)
    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=0.2,
    )
    last_err: Exception | None = None
    # Busy or rate-limited models are common on the free tier: back off, then fall back.
    fallbacks = config.GEMINI_FALLBACK_MODELS
    attempts = [(config.GEMINI_MODEL, 0)] + [(m, 0) for m in fallbacks]
    attempts += [(config.GEMINI_MODEL, 2)] + [(m, 2 + i) for i, m in enumerate(fallbacks)]
    for model, wait in attempts:
        if wait:
            time.sleep(wait)
        try:
            resp = _client().models.generate_content(model=model, contents=parts, config=cfg)
            return schema.model_validate(json.loads(resp.text)).model_dump()
        except errors.APIError as e:
            last_err = e
            retryable = getattr(e, "code", None) in (429, 500, 503) or "JSON mode is not enabled" in str(e)
            if retryable:
                continue
            raise AIError(f"Gemini error: {e}") from e
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
            continue
    raise AIError(f"Gemini unavailable: {last_err}")


# ---------- Prompt 1: read a promise (F1) ----------

class Deal(BaseModel):
    activity: str = Field(description="short verb phrase that fits after \"I'll\", e.g. \"practice guitar\"")
    proof: str = Field(description="one of gym, quiz, photo, friend")
    proof_hint: str = Field(description="one sentence: what a proof photo should show")
    target_count: int
    deadline: str = Field(description="ISO 8601 date-time with timezone offset")
    stake_usd: float
    recipient: str = Field(description='name or email of who gets the money, or "charity"')
    summary: str
    needs_clarification: str | None = None


PARSE_PROMPT = """You turn a person's goal into a clear deal for a habit app.
Today is {today}, timezone {tz}.
User wrote: "{text}"
People can promise anything. Return JSON:
activity (a short verb phrase that reads naturally after "I'll", lowercase, e.g. "go to the gym",
  "practice guitar for 30 minutes", "read 20 pages", "cook dinner at home"),
proof (how it will be proven, one of:
  gym = going to a gym or fitness class,
  quiz = studying or learning from notes,
  photo = anything else a photo of them doing it can show (running, music, cooking, cleaning, reading...),
  friend = things a photo cannot show, like not doing something ("no social media", "no smoking")),
proof_hint (one friendly sentence on what their proof photo should show, e.g. "You holding your guitar".
  Proof photos are always taken live with the app's camera, while doing it, holding up a secret word.
  Never suggest screenshots, receipts or photos of screens),
target_count (integer),
deadline (ISO date-time with the timezone offset; "this week" means this coming Sunday 23:59),
stake_usd (number, 1 to 100), recipient (name or email, or "charity"),
summary (one short sentence).
If something is missing or unclear, set needs_clarification to a short
question. Otherwise set needs_clarification to null."""


def parse_promise(text: str, now: datetime, tz: str) -> dict:
    prompt = PARSE_PROMPT.format(today=now.strftime("%A %Y-%m-%d %H:%M"), tz=tz, text=text.replace('"', "'"))
    return generate_json(prompt, Deal)
