"""Gemini calls. Every call uses JSON mode with a schema, so replies always parse.

If the main model is overloaded (503) or rate-limited (429), we retry once and
then fall back to GEMINI_FALLBACK_MODEL.
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
    for model in (config.GEMINI_MODEL, config.GEMINI_MODEL, config.GEMINI_FALLBACK_MODEL):
        try:
            resp = _client().models.generate_content(model=model, contents=parts, config=cfg)
            return schema.model_validate(json.loads(resp.text)).model_dump()
        except errors.APIError as e:
            last_err = e
            retryable = getattr(e, "code", None) in (429, 500, 503) or "JSON mode is not enabled" in str(e)
            if retryable:
                time.sleep(1)
                continue
            raise AIError(f"Gemini error: {e}") from e
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
            continue
    raise AIError(f"Gemini unavailable: {last_err}")


# ---------- Prompt 1: read a promise (F1) ----------

class Deal(BaseModel):
    type: str = Field(description="one of gym, study, run")
    target_count: int
    deadline: str = Field(description="ISO 8601 date-time with timezone offset")
    stake_usd: float
    recipient: str = Field(description='name or email of who gets the money, or "charity"')
    summary: str
    needs_clarification: str | None = None


PARSE_PROMPT = """You turn a person's goal into a clear deal for a habit app.
Today is {today}, timezone {tz}.
User wrote: "{text}"
Return JSON: type (one of gym, study, run), target_count (integer),
deadline (ISO date-time with the timezone offset; "this week" means this coming Sunday 23:59),
stake_usd (number, 1 to 100), recipient (name or email, or "charity"),
summary (one short sentence).
If something is missing or unclear, set needs_clarification to a short
question. Otherwise set needs_clarification to null."""


def parse_promise(text: str, now: datetime, tz: str) -> dict:
    prompt = PARSE_PROMPT.format(today=now.strftime("%A %Y-%m-%d %H:%M"), tz=tz, text=text.replace('"', "'"))
    return generate_json(prompt, Deal)
