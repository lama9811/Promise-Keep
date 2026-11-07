-- Promise agent (Nov 7). Safe to run more than once.
alter table pots add column if not exists agent_summary text;          -- the agent's one-paragraph wrap-up
alter table promises add column if not exists agent_note text;         -- the agent's note to this person
alter table payouts add column if not exists note text;

-- Everything the agent did, in order, so the app can show its work.
create table if not exists agent_events (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid references pots(id) on delete cascade,
  promise_id uuid references promises(id) on delete cascade,
  kind text not null check (kind in ('check', 'verify', 'hold', 'refund', 'payout', 'done', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_pot_idx on agent_events(pot_id);
create index if not exists agent_events_created_idx on agent_events(created_at desc);
-- At most one refund per promise, even if two runs race.
create unique index if not exists payouts_one_refund on payouts(promise_id) where kind = 'refund';
alter table agent_events enable row level security;
