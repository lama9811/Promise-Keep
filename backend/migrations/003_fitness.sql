-- Fitness only (Nov 7): goals, connected apps, and proofs that come from them. Safe to run more than once.

-- What one "time" means for this promise: 10000 steps, 5 km, 30 minutes, or one gym visit.
alter table promises add column if not exists goal_metric text
  check (goal_metric in ('steps', 'distance_km', 'minutes', 'visit'));
alter table promises add column if not exists goal_value numeric;

-- Proof can now also come from Strava, WHOOP, Apple Health (via the iPhone Shortcut) or a screenshot.
alter table promises drop constraint if exists promises_proof_check;
alter table promises add constraint promises_proof_check
  check (proof in ('gym', 'steps', 'run', 'workout', 'quiz', 'photo', 'friend'));
alter table proofs drop constraint if exists proofs_kind_check;
alter table proofs add constraint proofs_kind_check
  check (kind in ('checkin', 'photo', 'quiz', 'friend', 'strava', 'whoop', 'health', 'screenshot'));
alter table proofs add column if not exists metric_value numeric;   -- steps, km or minutes this proof showed
alter table proofs add column if not exists source_id text;         -- e.g. the Strava activity id
alter table proofs add column if not exists source_label text;      -- "Morning Run, 5.2 km"
-- The same Strava run or WHOOP workout can only ever be used once per promise.
create unique index if not exists proofs_one_source on proofs(promise_id, kind, source_id) where source_id is not null;

-- Connected fitness accounts. Tokens are secrets: only the server reads this table.
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'whoop')),
  external_id text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table connections enable row level security;

-- The iPhone Shortcut proves steps with a personal key. Only its hash is stored.
alter table users add column if not exists shortcut_key_hash text unique;
