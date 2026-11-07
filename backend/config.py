"""Settings read from the environment (.env locally, env vars on Render)."""
import os

from dotenv import load_dotenv

load_dotenv()

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET", "")
PAYPAL_BASE = os.getenv("PAYPAL_BASE", "https://api-m.sandbox.paypal.com")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
# Tried in order when the main model is busy (503) or rate-limited (429).
GEMINI_FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite,gemini-2.5-flash").split(",")
    if m.strip()
]

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("1", "true", "yes")

FRONTEND_ORIGINS = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5180").split(",")
    if o.strip()
]

# ---------- Promise agent ----------
# Where "charity" stakes go. In the sandbox this is one of your sandbox personal accounts.
CHARITY_EMAIL = os.getenv("CHARITY_EMAIL", "").strip().lower()
# How often the agent looks for passed deadlines while the server runs (0 = never; use /agent/run).
AGENT_INTERVAL_SECONDS = int(os.getenv("AGENT_INTERVAL_SECONDS", "60"))
# Secret for POST /agent/run (a Render cron job calls it). Empty = the endpoint is off.
AGENT_KEY = os.getenv("AGENT_KEY", "")
# If a proof is still waiting for a review that could change the result, wait this long past the deadline.
AGENT_HOLD_MINUTES = int(os.getenv("AGENT_HOLD_MINUTES", "60"))

# ---------- Connected fitness apps ----------
STRAVA_CLIENT_ID = os.getenv("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET", "")
WHOOP_CLIENT_ID = os.getenv("WHOOP_CLIENT_ID", "")
WHOOP_CLIENT_SECRET = os.getenv("WHOOP_CLIENT_SECRET", "")
# Where the browser app lives; OAuth sends people back to {APP_URL}/connect/<provider>.
APP_URL = os.getenv("APP_URL", FRONTEND_ORIGINS[0] if FRONTEND_ORIGINS else "http://localhost:5180").rstrip("/")
# Signs the OAuth "state" so a connect link can't be finished by someone else.
STATE_SECRET = os.getenv("STATE_SECRET", "") or __import__("hashlib").sha256(("pk-state:" + SUPABASE_KEY).encode()).hexdigest()
