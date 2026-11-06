# Promise Keeper

Users bet real (sandbox) money on their own goals. An AI (Gemini) checks the proof:
gym check-in with a live-word photo, or a quiz on their own study notes. At the
deadline, PayPal refunds people who kept the promise and pays out the losers'
stakes to a friend, the winners or charity. Built for the PayPal + AI Devpost
hackathon, due Thu Nov 12, 2026, 12:00 PM PST (we aim to submit by 9:00 AM PST).
Plan and schedule: APPROACH.md. Full spec: ~/Desktop/Promise-Keeper-PRD-and-Build-Guide.pdf.

## Hard rules
- Money is always stored as whole cents (integers). 2000 = $20.00. No floats.
- Never send quiz expected answers to the browser.
- Every PayPal refund uses a unique `PayPal-Request-Id`, and every payout uses a
  unique `sender_batch_id`, so `/settle` is safe to run many times.
- `.env` is never committed. Only the backend holds secrets.
- Every stake ends as exactly one refund or one payout. No money left in limbo.
- A promise only becomes `active` when the capture status is `COMPLETED` (not `PENDING`).
- The promise owner is the PayPal account that actually paid (`payer.email_address`
  from the capture), not the email typed in the form.
- Photos live in a **private** Supabase bucket; show them only through short-lived
  signed URLs (`db.photo_url`) after checking who is asking.
- API errors to the browser are generic; details go to the server log.

## Run it
- Backend: `cd backend && .venv/bin/uvicorn main:app --reload --port 8010`
- Frontend: `cd frontend && npm run dev` (serves on **5180**)
- Tests: `cd backend && .venv/bin/pytest` (fake DB + fake PayPal in `tests/conftest.py`)
- PayPal sandbox check: `cd backend && .venv/bin/python scripts/paypal_smoke.py <receiver-sandbox-email>`
- Ports 8000 and 5173 belong to other local projects. Don't kill them.
- Python is 3.13 (`backend/.venv`); 3.11 isn't installed.

## Layout
- `backend/main.py`: FastAPI routes. `paypal.py`: httpx calls (token, order, capture,
  refund, payouts). `ai.py`: Gemini JSON-mode calls. `deals.py`: validates AI output
  in code. `settle_math.py`: pure pot-split math. `db.py`: Supabase helpers.
  `schema.sql`: paste into Supabase SQL Editor.
- `frontend/src/pages/`: `Home` (hero + composer + deal sheet), `PromisePage` (`/p/:id`), `NotFound`.
- `frontend/src/components/`: `DealSheet` (contract sentence + PayPal button), `GymPicker` (Leaflet, lazy-loaded).
- `frontend/src/three/`: the 3D coin. `coinStore.js` is shared state the coin reads every
  frame (modes `idle` / `deal` / `locked` / `progress`); call `setCoin` / `kickCoin`
  instead of passing props.
- Env: `backend/.env` (see `.env.example`), `frontend/.env.local` (`VITE_API_URL`, `VITE_PAYPAL_CLIENT_ID`).

## Status (update as steps finish)
- Done: Step 1 skeleton, Step 2 PayPal sandbox smoke test (capture, refund and payout all succeeded),
  Step 4 F1 + F2 code (parse, create, capture, promise page), the frontend redesign, and the settle split math with tests.
- Waiting: `schema.sql` not yet run in Supabase, so the real pay → promise page flow is untested.
- Next: Step 5 gym check-in + live-word photo (F3, F4), then quiz (F5), settle + group pots
  (F6, F7), referee + demo mode + deploy (F8, F9).

## Design system (keep new screens consistent)
- Cobalt `#1e3bff` background, paper `#f4f6ff`, ink `#0a1240`. Mint `#6ef0be` only for
  "kept", rose `#ff4d6d` only for "broken" (`broke-ink #c0123a` for error text on paper).
  Tokens live in `frontend/src/index.css` (`@theme`).
- Fonts: Bricolage Grotesque (display), Hanken Grotesk (body), from @fontsource.
- The 3D chrome coin is the one bold element. Use it for big moments (flip, ring clamp,
  ring segment lighting up) rather than adding new effects elsewhere.
- Avoid: all-caps labels, arrows on buttons, grids of identical cards, scroll fade-ins on every section.
- Copy: plain, active, sentence case. Errors say what happened and how to fix it.
- Always check with screenshots at 1440×900 and 390×844.

## Gotchas
- Gemini: pin `api_version="v1beta"` (already in `ai.py`), or JSON mode sometimes fails.
  Model `gemini-3.5-flash`, fallback `gemini-2.5-flash` (3.7 and 3.8 returned 503s on Nov 6).
- PayPal sandbox checkout page can hang on "reviewing payment" when an order has no
  return URL. The order is still APPROVED. The in-app JS button pop-up isn't affected.
- `@paypal/react-paypal-js` v10: use the classic `PayPalScriptProvider` + `PayPalButtons`
  from the root import. Read form state through a ref in `createOrder`.
- Lenis smooth scroll keeps its own position: route changes go through `ScrollManager` in `App.jsx`.
- Coin engravings are drawn on a canvas with the page font, so `CoinStage` waits for `document.fonts.ready`.
- Vercel needs `frontend/vercel.json` rewrites for `/p/:id` routes.
