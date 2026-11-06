-- Promise Keeper schema. Paste into Supabase > SQL Editor and run once.
-- All money columns are integers in cents (2000 = $20.00).

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  paypal_email text not null,           -- sandbox email for refunds/payouts
  created_at timestamptz not null default now()
);

-- One pot = one group bet. A solo promise is a pot of 1.
create table if not exists pots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references users(id),
  deadline timestamptz not null,
  recipient text not null default 'charity',  -- gets the money if nobody wins
  is_demo boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists promises (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references pots(id) on delete cascade,
  user_id uuid not null references users(id),
  raw_text text not null,
  type text not null check (type in ('gym', 'study', 'run')),
  target_count integer not null check (target_count > 0),
  stake_cents integer not null check (stake_cents between 100 and 10000),
  recipient text not null,               -- friend email or 'charity'
  summary text,
  gym_lat double precision,
  gym_lng double precision,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'won', 'lost', 'settled')),
  outcome text check (outcome in ('won', 'lost')),  -- kept after status becomes settled
  paypal_order_id text,
  paypal_capture_id text,
  created_at timestamptz not null default now(),
  unique (pot_id, user_id)               -- one promise per person per pot
);

create table if not exists proofs (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references promises(id) on delete cascade,
  kind text not null check (kind in ('checkin', 'photo', 'quiz', 'strava')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  lat double precision,
  lng double precision,
  photo_path text,
  photo_hash text,                       -- imagehash.phash as hex
  live_word text,
  live_word_expires_at timestamptz,
  ai_verdict text check (ai_verdict in ('pass', 'fail', 'unsure')),
  ai_reason text,
  ai_confidence real,
  referee_decision text check (referee_decision in ('approve', 'reject')),
  counted boolean not null default false -- true once this proof counts toward target_count
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references proofs(id) on delete cascade,
  questions jsonb not null,              -- [{question, expected_answer}]; answers never sent to browser
  answers jsonb,
  results jsonb,
  score integer,
  expires_at timestamptz not null
);

-- Every money movement, so judges can see the PayPal IDs.
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references pots(id) on delete cascade,
  promise_id uuid references promises(id),  -- whose refund, or which winner received it
  kind text not null check (kind in ('refund', 'payout')),
  receiver text not null,                -- email the money went to
  amount_cents integer not null check (amount_cents > 0),
  paypal_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists promises_pot_idx on promises(pot_id);
create index if not exists proofs_promise_idx on proofs(promise_id);
create index if not exists payouts_pot_idx on payouts(pot_id);
create index if not exists pots_unsettled_idx on pots(deadline) where settled_at is null;

-- Photo storage bucket. Private: photos are only shown through short-lived
-- signed URLs that the server creates after checking who is asking.
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;
