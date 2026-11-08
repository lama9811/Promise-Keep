# Promise Keeper

Users bet real (sandbox) money on their own goals, about anything they choose. An AI
(Gemini) checks the proof: a gym check-in plus a live-word photo, a live-word photo of
the activity, a quiz on their own study notes, or a friend's confirmation. At the
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
- A promise belongs to the signed-in account (Supabase Auth: Google or email link). Only the
  owner can capture or prove it (`auth.owned_promise`; anyone else gets a 404). Money goes back
  to the PayPal account that actually paid (`promises.payer_email`, from the capture), never a typed email.
- Every write route uses `Depends(auth.current_user)`. `GET /promises/{id}` stays public (share links).
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
- `backend/auth.py`: checks the browser's Supabase access token, finds or creates the `users` row.
- `backend/main.py`: FastAPI routes (promises, `/me`, `/me/promises`). `proof_routes.py`: check-in, live word, photo referee.
  `views.py`: what the browser may see. `checks.py`: haversine, phash duplicates, EXIF date. `words.py`: 200 live words.
  `paypal.py`: httpx calls (token, order, capture,
  refund, payouts, `verify_capture` via PayPal's agent toolkit). `agent.py`: the promise agent (Gemini function
  calling, runs every `AGENT_INTERVAL_SECONDS` and on `POST /agent/run` with `X-Agent-Key`). `settle.py`: the guarded
  money tools the agent calls; all money rules live there, plus `finish_by_code` as the backstop. `ai.py`: Gemini JSON-mode calls. `deals.py`: validates AI output
  in code. `settle_math.py`: pure pot-split math. `db.py`: Supabase helpers.
  `schema.sql`: paste into Supabase SQL Editor.
- `frontend/src/pages/`: `Home` (`/`, landing only: hero, coin, "Make your first promise" button, How it works),
  `SignIn` (`/signin`: Google + email link + demo button), `app/*` (sign-in required, inside `src/app/AppShell.jsx`:
  sidebar on desktop, bottom tabs on phones): `Overview` (`/app`), `NewPromise` (`/app/new`: composer + deal sheet + coin),
  `Promises`, `Activity`, `Wallet`, `Account`. Shared hooks in `src/app/data.js`, UI bits in `src/app/ui.jsx`.
  Numbers shown there come only from real promises and proofs, never made-up data. `PromisePage` (`/p/:id`, public; Prove panel only when `is_mine`), `NotFound`.
- `frontend/src/auth.jsx`: `AuthProvider`, `useAuth`, `RequireAuth`. `src/lib/supabase.js` is used for sign-in only;
  `api.js` adds the `Authorization: Bearer` token to every call.
- `frontend/src/components/`: `DealSheet` (contract sentence + proof choice + PayPal button),
  `GymPicker` (Leaflet, lazy-loaded, gym proofs only), `ProvePanel` (the step-by-step "Prove it"
  card on the promise page), `LiveCamera` (in-app camera only, no gallery), `HowItWorks` (motion cards).
- `frontend/src/three/`: the 3D coin. `coinStore.js` is shared state the coin reads every
  frame (modes `idle` / `deal` / `locked` / `progress`); call `setCoin` / `kickCoin`
  instead of passing props.
- Env: `backend/.env` (see `.env.example`), `frontend/.env.local` (`VITE_API_URL`, `VITE_PAYPAL_CLIENT_ID`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

## Status (update as steps finish)
- FITNESS ONLY (user decision, Nov 7; replaces "anything"). Proof types: `gym`, `steps`, `run`, `workout`, each with
  `goal_metric`/`goal_value` (10000 steps, 5 km, 30 min, gym = visit). Sources: Strava + WHOOP (OAuth, `connect.py`),
  Apple Health via an iPhone Shortcut (`POST /shortcut/steps`, per-user key, only its hash stored), screenshots read by
  Gemini (`ai.read_fitness_screenshot`), gym check-in + live photo. All counting rules in `fitness.record`: inside the
  promise window, reaches the goal, one counted per day, a source id never reused. `migrations/003_fitness.sql`.
  Old proof types (photo/quiz/friend) still load but can't be created.
- Apple Fitness rings (Nov 8): proof types `exercise` (minutes) and `move` (Move calories), Apple-only (Shortcut via
  `POST /shortcut/activity` with steps/exercise_minutes/move_calories, or a ring screenshot). `migrations/004_rings.sql`.
  Strava ignores `manual` (hand-typed) activities. WHOOP app is NOT allowed `read:profile` (don't request it).
- (Superseded) Promises can be about anything (user decision, Nov 6). `promises.activity` is free text;
  `promises.proof` is how it's proven: `gym` (150 m + 30 min + live-word photo), `photo`
  (live-word photo of doing it), `quiz` (Step 6), `friend` (F8).
- Done: Steps 1, 2 (PayPal sandbox smoke test passed), 4 (F1, F2), 5 backend + screens
  (check-in, live word, photo referee), settle split math, light redesign.
- Accounts (Nov 6): sign-up lives at `/signin`; the composer moved off the landing page into `/app`.
- Promise agent (Nov 7): settles pots automatically at the deadline (user chose automatic, no approval step).
  Needs `migrations/002_agent.sql` run in Supabase and `CHARITY_EMAIL` (a sandbox personal account) in `backend/.env`.
  Gemini wants tool results sent back with role `user` (role `tool` is rejected).
  `paypal-agent-toolkit` is installed with `--no-deps` (its extras pin langchain/crewai); only `shared/` is used.
- Backend tests: 84 passing. Tests sign in with the fake token `tok-<name>` (`conftest.as_user`).
- Nov 6: `schema.sql` run in Supabase (6 tables, RLS on, private `proofs` bucket); publishable key set.
  The Supabase SQL Editor kept sending empty queries, so schema changes were run with psycopg over the
  direct DB host (IPv6 works here). Still waiting: Google provider switched on, and
  `http://localhost:5180/**` added to Supabase Auth redirect URLs.
- Next: quiz (F5), settle + group pots (F6, F7), friend referee (F8), demo mode + deploy (F9).
- Rules added beyond the PRD: the live word is issued at "I'm done" (not at check-in), because a
  10-minute word can't survive a 30-minute stay; one counted proof per 12 hours
  (`promises.last_counted_at` compare-and-set).

## Design system (keep new screens consistent)
- Light and bright. Canvas `#f6f7fb`, surface white, line `#e3e6f0`, ink `#0a1240`,
  ink-soft `#565e85`. Cobalt `#1e3bff` is the accent (buttons, editable blanks, links).
  Kept `#0e9f72` / soft `#d8f6ea`, broke `#e5364f` / soft `#ffe1e6`, sun `#ffd84a` /
  soft `#fff3b8`. Tokens live in `frontend/src/index.css` (`@theme`).
- The user rejected the all-cobalt dark version on Nov 6. Don't go back to dark backgrounds.
- Fonts: Bricolage Grotesque (display), Hanken Grotesk (body), from @fontsource.
- Hero: the 3D chrome coin, with a soft sky and sun glow behind it. The 3D environment stays
  dark inside (`#26305e`) so the chrome has contrast on a light page.
- "How it works" = `components/HowItWorks.jsx`: sticky stacked motion cards (sky / mint /
  sun tints) that shrink as the next one stacks over them, tilt toward the cursor, and
  carry small live illustrations with depth (translateZ). Reuse this card style for new sections.
- Avoid: all-caps labels, arrows on buttons, scroll fade-ins on every section.
- Copy: plain, active, sentence case. Errors say what happened and how to fix it.
- Always check with screenshots at 1440×900 and 390×844.

## Gotchas
- Gemini: pin `api_version="v1beta"` (already in `ai.py`), or JSON mode sometimes fails.
  Model `gemini-3.5-flash`, fallbacks `gemini-3.5-flash-lite`, `gemini-2.5-flash` with backoff. On Nov 6
  the flash models often returned 503 while flash-lite kept answering.
- PayPal sandbox checkout page can hang on "reviewing payment" when an order has no
  return URL. The order is still APPROVED. The in-app JS button pop-up isn't affected.
- `@paypal/react-paypal-js` v10: use the classic `PayPalScriptProvider` + `PayPalButtons`
  from the root import. Read form state through a ref in `createOrder`.
- Lenis smooth scroll keeps its own position: route changes go through `ScrollManager` in `App.jsx`.
- Coin engravings are drawn on a canvas with the page font, so `CoinStage` waits for `document.fonts.ready`.
- Vercel needs `frontend/vercel.json` rewrites for `/p/:id` routes.
