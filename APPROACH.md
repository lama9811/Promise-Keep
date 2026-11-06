# Promise Keeper: How We Will Approach the Build

_Source: Promise-Keeper-PRD-and-Build-Guide.pdf · Written Fri Nov 6, 2026 · Due Thu Nov 12, 2026, 12:00 PM PST (we aim to submit by 9:00 AM PST)_

**The product in one line:** you bet money on your own goal, the AI checks your proof, and PayPal refunds you or pays your friend or a charity automatically.

---

## 1. Guiding principles
1. **Build the riskiest part first.** PayPal moving money (Orders → Capture → Refund → Payouts) gets proven on Day 2 with a test script, before any UI exists. If Payouts doesn't work in sandbox, we need to find out on Saturday, not Wednesday.
2. **Each step ends with a test.** A step counts as done only when its "done when" check passes. Then we commit, so we always have a save point.
3. **Get a working demo first, then polish.** The goal is that a judge can go from creating a promise to seeing the payout in under 2 minutes on a laptop. Demo mode (F9) is treated as required.
4. **Cheat checks are core, not polish.** If an old photo passes, the idea fails. Code checks run first, then the AI, then a human referee.
5. **No money gets stuck.** Every stake ends as exactly one refund or one payout. Settling is safe to run more than once (PayPal request IDs `refund-<promise_id>`, batch ID `pot-<pot_id>`). Money is always stored as whole cents.
6. **Everything runs on free tiers ($0)** and is reachable from a public HTTPS link.

## 2. Architecture (as the PRD describes it)
- **Frontend:** React + Vite + Tailwind on Vercel. It includes the PayPal JS button, `getUserMedia` for in-app camera only, `navigator.geolocation` for location, and a Leaflet map for picking the gym.
- **Backend:** FastAPI (Python 3.11) on Render's free tier. It is the only part that holds secrets.
- **Data:** Supabase, using Postgres tables (users, pots, promises, proofs, quizzes, payouts) and a storage bucket called `proofs`.
- **AI:** Gemini through `google-genai` in JSON mode, for 4 jobs: parse a promise, check a photo, write a quiz, grade a quiz. On Day 1 we confirm the current model name and free-tier limits, because `gemini-2.5-flash` may be outdated by now. Claude is the fallback.
- **Payments:** PayPal REST sandbox called through `httpx`: token, orders, capture, refund, payouts.
- **Deadline checks:** `POST /settle`, which runs on every pot page load and every 10 minutes from cron-job.org. A Render server sleeps when idle, so a background timer can't be trusted.

Repo layout: `backend/` (main.py, paypal.py, db.py, ai.py, schema.sql, scripts/, tests/) and `frontend/`, plus `CLAUDE.md`, `README.md` and `.gitignore`.

## 3. Build order and schedule

| Day | Step | Features | Test before moving on |
|---|---|---|---|
| Fri Nov 6 | 0: accounts (GitHub, PayPal dev + 6 sandbox accounts, Gemini, Supabase, Vercel, Render) | n/a | All 6 secrets saved in a private note |
| Fri Nov 6 | 1: skeleton (FastAPI `/health`, Vite app, `.env.example`, CLAUDE.md) | n/a | Page shows "ok" |
| Sat Nov 7 | 2: **PayPal smoke script** (riskiest) | F2/F6 base | Sandbox business account shows a payment, a refund and a payout |
| Sat Nov 7 | 3: Supabase schema + `db.py` | n/a | 6 tables visible |
| Sun Nov 8 | 4: create a promise + pay | F1, F2 | "gym 3x this week or $20 to Alex", pay, see "0 of 3" |
| Sun–Mon | 5: gym check-in + live-word photo + cheat checks | F3, F4 | Right word passes; duplicate photo rejected; missing word fails with a reason |
| Mon Nov 9 | 6: study quiz (answers stay on the server, 5-minute timer kept by the server) | F5 | Real notes + right answers pass; "idk" fails; a late answer is refused |
| Tue Nov 10 | 7: settling + group pots, with pytest for the split math | F6, F7 | pytest passes (5 people / 2 losers → $6.67, $6.67, $6.66); a real 3-person sandbox pot settles correctly |
| Tue–Wed | 8: friend referee, demo mode, deploy (Render + Vercel + cron) | F8, F9 | Full demo works on a phone through the Vercel link |
| Wed Nov 11 | 9: polish, README, record the 3-minute video | (F10 Strava only if everything else works) | Video is under 3:00 |
| Thu Nov 12 | 10: submit on Devpost by 9:00 AM PST | n/a | Page says "submitted" |

## 4. How proof gets checked (gym visit)
These run in order, and the first failure stops the check:
1. Phone is within 150 m of the gym (haversine distance).
2. At least 30 minutes between "I'm here" and "Done", and the phone is still on site.
3. Photo comes from the in-app camera only. There is no gallery upload.
4. Duplicate check: if the phash difference from any earlier photo is 6 or less, reject.
5. Gemini checks that the live word is visible, the place looks like a gym, and the photo isn't of a screen.
6. If the AI's confidence is under 0.7, the friend referee approves or rejects it.

The AI always returns a reason, and the user sees it. The video says plainly what these checks can't stop (fake-GPS apps, someone who sits in the gym without exercising).

## 5. If time runs short
- **What to cut, in order:** F10 Strava → F8 referee → F7 group pot. **Never cut F9 demo mode.**
- **Minimum project we can submit:** steps 2, 4 and 7 (money moves, a promise is created, settlement happens).
- **If Payouts fails in sandbox:** fall back to refunds only, send the friend an invoice, and say so in the write-up.
- **If we hit the Gemini limit:** use stored sample responses in demo mode, or switch to Claude.
- **If location is slow indoors:** allow a 300 m radius and add a "retry location" button.
- **If Render is asleep:** the README warns the first load takes about 40 seconds, and the cron job keeps the server awake during judging.

## 6. Working agreement with Claude Code
- We follow the PRD's step prompts in order. Each step is built, tested, then committed.
- Hard rules go into `CLAUDE.md`: money in cents, quiz answers never sent to the browser, a unique request ID on every PayPal call, `.env` never committed.
- Before each step I confirm the plan for that step. After it, I run the step's test and show you the output.

