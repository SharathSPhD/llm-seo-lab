-- llm-seo-lab v0.4.0 — SQLite (Cloudflare D1 + local better-sqlite3) schema
-- Spec: docs/v0.4.0/spec.md §8
--
-- This is the SQLite-flavored equivalent of v0.3.0's
-- infra/supabase/migrations/0001_init.sql with:
--   - gen_random_uuid()        -> driver-side lower(hex(randomblob(16)))
--   - timestamptz default now()-> text default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
--   - jsonb                    -> text (drivers serialize/deserialize JSON)
--   - text[]                   -> text storing JSON array
--   - Postgres enums           -> text + check constraint
--   - RLS + ownership trigger  -> enforced in StateDriver app layer
--
-- The schema is identical between local SQLite (data/state/llm-seo-lab.db)
-- and Cloudflare D1; the JsonlSqliteDriver and D1HttpDriver both consume
-- it. The drivers enforce the ownership invariant
-- (row.user_id === use_cases.user_id for the parent use_case_id) before
-- any INSERT/UPDATE; D1 has no triggers in v0.4.0 so a missing guard
-- would be a driver-layer bug, not a database-layer one.

create table if not exists use_cases (
  id text primary key,
  user_id text not null,
  url text not null,
  substrate text not null check (substrate in ('web', 'substack', 'youtube')),
  title text not null,
  topic text not null,
  target_audience text,
  current_stage text not null default 'DRAFT' check (current_stage in (
    'DRAFT','RECOMMENDED','APPLIED','REPUBLISHED',
    'MEASURING','MEASURED','ANALYZED','ABANDONED'
  )),
  current_iteration integer not null default 0,
  notes text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists use_cases_user_idx on use_cases (user_id, updated_at desc);

create table if not exists use_case_events (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  user_id text not null,
  from_stage text check (from_stage is null or from_stage in (
    'DRAFT','RECOMMENDED','APPLIED','REPUBLISHED',
    'MEASURING','MEASURED','ANALYZED','ABANDONED'
  )),
  to_stage text not null check (to_stage in (
    'DRAFT','RECOMMENDED','APPLIED','REPUBLISHED',
    'MEASURING','MEASURED','ANALYZED','ABANDONED'
  )),
  iteration integer not null,
  payload text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists use_case_events_uc_idx on use_case_events (use_case_id, created_at);

create table if not exists recommendations (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  user_id text not null,
  iteration integer not null,
  triz_principle text not null,
  applicability_score real not null,
  knob text not null,
  diff_summary text not null,
  payload text not null,
  rationale text not null,
  expected_engines text not null,
  claude_run_id text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists recs_uc_iter_idx on recommendations (use_case_id, iteration);

create table if not exists applications (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  recommendation_id text not null references recommendations(id) on delete cascade,
  user_id text not null,
  iteration integer not null,
  artifact_kind text not null,
  artifact_summary text not null,
  applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists applications_uc_iter_idx on applications (use_case_id, iteration);

create table if not exists measurements (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  user_id text not null,
  iteration integer not null,
  engine text not null,
  prompt text not null,
  observed_answer text not null,
  citation_present integer not null check (citation_present in (0, 1)),
  citation_position integer,
  source_authority text,
  notes text,
  screenshot_path text,
  observed_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists meas_uc_iter_idx on measurements (use_case_id, iteration);

create table if not exists analyses (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  user_id text not null,
  iteration integer not null,
  verdict text not null check (verdict in ('improved','stable','regressed','inconclusive','stub')),
  per_engine_delta text,
  attractor_metrics text,
  triz_principles_cited text,
  next_iteration_suggestion text,
  claude_run_id text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists analyses_uc_iter_idx on analyses (use_case_id, iteration);

-- Intent queue (v0.4.0 spec §6, R8.6) — hosted dashboard buttons enqueue
-- pending_actions; the local plugin's /pull:sync command picks them up
-- and writes back status='executed' once dispatched.
create table if not exists pending_actions (
  id text primary key,
  use_case_id text not null references use_cases(id) on delete cascade,
  requested_stage text not null check (requested_stage in (
    'DRAFT','RECOMMENDED','APPLIED','REPUBLISHED',
    'MEASURING','MEASURED','ANALYZED','ABANDONED'
  )),
  requested_by text not null,
  requested_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status text not null default 'pending' check (status in ('pending','executed','failed')),
  executed_at text,
  result text
);

create index if not exists pending_actions_user_status_idx on pending_actions (requested_by, status);
create index if not exists pending_actions_uc_idx on pending_actions (use_case_id);
