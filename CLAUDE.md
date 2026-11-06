# Promise Keeper

Users bet real (sandbox) money on their own goals. An AI (Gemini) checks the proof:
gym check-in with a live-word photo, or a quiz on their own study notes. At the
deadline, PayPal refunds people who kept the promise and pays out the losers'
stakes to a friend, the winners or charity. Built for the PayPal + AI Devpost
hackathon, due Thu Nov 12, 2026, 12:00 PM PST. Plan: APPROACH.md.

## Hard rules
- Money is always stored as whole cents (integers). 2000 = $20.00. No floats.
- Never send quiz expected answers to the browser.
- Every PayPal refund uses a unique `PayPal-Request-Id`, and every payout uses a
  unique `sender_batch_id`, so `/settle` is safe to run many times.
- `.env` is never committed. Only the backend holds secrets.
- Every stake ends as exactly one refund or one payout. No money left in limbo.

## Layout
- `backend/`: FastAPI on Python 3.13 (`.venv`). Run: `cd backend && .venv/bin/uvicorn main:app --reload --port 8010`
- `frontend/`: React + Vite + Tailwind v4. Run: `cd frontend && npm run dev`
- Tests: `cd backend && .venv/bin/pytest`
