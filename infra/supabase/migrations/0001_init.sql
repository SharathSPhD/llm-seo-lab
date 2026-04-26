-- llm-seo-lab v0.3.0 Supabase schema + RLS
-- Spec: docs/v0.3.0/spec.md §4
--
-- This migration is idempotent on a fresh project. RLS policies use
-- `auth.uid() = user_id` on every owner-bound table. A trigger guards
-- service-role inserts so MCP cannot escalate beyond the owning user
-- (spec §6).

create extension if not exists "pgcrypto";

----------------------------------------------------------------------
-- profiles: 1:1 with auth.users; display name lives here
----------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles self-read" on public.profiles;
create policy "profiles self-read"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles self-write" on public.profiles;
create policy "profiles self-write"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

----------------------------------------------------------------------
-- enums
----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'use_case_stage') then
    create type public.use_case_stage as enum (
      'DRAFT', 'RECOMMENDED', 'APPLIED', 'REPUBLISHED',
      'MEASURING', 'MEASURED', 'ANALYZED', 'ABANDONED'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'substrate') then
    create type public.substrate as enum ('web', 'substack', 'youtube');
  end if;
end $$;

----------------------------------------------------------------------
-- use_cases: one row per (user, URL, iteration cycle)
----------------------------------------------------------------------
create table if not exists public.use_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  url text not null,
  substrate public.substrate not null,
  title text not null,
  topic text not null,
  target_audience text,
  current_stage public.use_case_stage not null default 'DRAFT',
  current_iteration int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists use_cases_user_idx on public.use_cases (user_id, updated_at desc);

alter table public.use_cases enable row level security;

drop policy if exists "use_cases owner read" on public.use_cases;
create policy "use_cases owner read"
  on public.use_cases for select
  using (user_id = auth.uid());

drop policy if exists "use_cases owner write" on public.use_cases;
create policy "use_cases owner write"
  on public.use_cases for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

----------------------------------------------------------------------
-- use_case_events: append-only state-machine log
----------------------------------------------------------------------
create table if not exists public.use_case_events (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  from_stage public.use_case_stage,
  to_stage public.use_case_stage not null,
  iteration int not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists use_case_events_uc_idx on public.use_case_events (use_case_id, created_at);

alter table public.use_case_events enable row level security;

drop policy if exists "events owner read" on public.use_case_events;
create policy "events owner read"
  on public.use_case_events for select
  using (user_id = auth.uid());

drop policy if exists "events owner write" on public.use_case_events;
create policy "events owner write"
  on public.use_case_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

----------------------------------------------------------------------
-- recommendations: written by MCP pull_recommend
----------------------------------------------------------------------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  triz_principle text not null,
  applicability_score numeric(4,3) not null,
  knob text not null,
  diff_summary text not null,
  payload jsonb not null,
  rationale text not null,
  expected_engines text[] not null,
  claude_run_id text,
  created_at timestamptz not null default now()
);

create index if not exists recs_uc_iter_idx on public.recommendations (use_case_id, iteration);

alter table public.recommendations enable row level security;

drop policy if exists "recs owner read" on public.recommendations;
create policy "recs owner read"
  on public.recommendations for select
  using (user_id = auth.uid());

drop policy if exists "recs owner write" on public.recommendations;
create policy "recs owner write"
  on public.recommendations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

----------------------------------------------------------------------
-- applications: written by dashboard when user marks applied
----------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases on delete cascade,
  recommendation_id uuid not null references public.recommendations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  artifact_kind text not null,
  artifact_summary text not null,
  applied_at timestamptz not null default now()
);

create index if not exists applications_uc_iter_idx on public.applications (use_case_id, iteration);

alter table public.applications enable row level security;

drop policy if exists "apps owner read" on public.applications;
create policy "apps owner read"
  on public.applications for select
  using (user_id = auth.uid());

drop policy if exists "apps owner write" on public.applications;
create policy "apps owner write"
  on public.applications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

----------------------------------------------------------------------
-- measurements: written ONLY by the dashboard form
----------------------------------------------------------------------
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  engine text not null,
  prompt text not null,
  observed_answer text not null,
  citation_present boolean not null,
  citation_position int,
  source_authority text,
  notes text,
  screenshot_path text,
  observed_at timestamptz not null default now()
);

create index if not exists meas_uc_iter_idx on public.measurements (use_case_id, iteration);

alter table public.measurements enable row level security;

drop policy if exists "meas owner read" on public.measurements;
create policy "meas owner read"
  on public.measurements for select
  using (user_id = auth.uid());

drop policy if exists "meas owner write" on public.measurements;
create policy "meas owner write"
  on public.measurements for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

----------------------------------------------------------------------
-- analyses: written by MCP pull_analyze
----------------------------------------------------------------------
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  iteration int not null,
  verdict text not null check (verdict in ('improved','stable','regressed','inconclusive','stub')),
  per_engine_delta jsonb,
  attractor_metrics jsonb,
  triz_principles_cited text[],
  next_iteration_suggestion text,
  claude_run_id text,
  created_at timestamptz not null default now()
);

create index if not exists analyses_uc_iter_idx on public.analyses (use_case_id, iteration);

alter table public.analyses enable row level security;

drop policy if exists "analyses owner read" on public.analyses;
create policy "analyses owner read"
  on public.analyses for select
  using (user_id = auth.uid());

drop policy if exists "analyses owner write" on public.analyses;
create policy "analyses owner write"
  on public.analyses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

----------------------------------------------------------------------
-- Service-role guard (spec §6): MCP runs with the service-role key, which
-- bypasses RLS. We still want it to fail loudly if it ever tries to
-- write a row whose `user_id` does not own the `use_case_id`. This
-- trigger fires on every insert/update into the four child tables.
----------------------------------------------------------------------
create or replace function public.assert_user_owns_use_case()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.use_cases where id = new.use_case_id;
  if owner is null then
    raise exception 'use_case % does not exist', new.use_case_id;
  end if;
  if owner is distinct from new.user_id then
    raise exception 'user_id % does not own use_case % (owner=%)', new.user_id, new.use_case_id, owner;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_recs on public.recommendations;
create trigger guard_recs
  before insert or update on public.recommendations
  for each row execute function public.assert_user_owns_use_case();

drop trigger if exists guard_apps on public.applications;
create trigger guard_apps
  before insert or update on public.applications
  for each row execute function public.assert_user_owns_use_case();

drop trigger if exists guard_meas on public.measurements;
create trigger guard_meas
  before insert or update on public.measurements
  for each row execute function public.assert_user_owns_use_case();

drop trigger if exists guard_analyses on public.analyses;
create trigger guard_analyses
  before insert or update on public.analyses
  for each row execute function public.assert_user_owns_use_case();

drop trigger if exists guard_events on public.use_case_events;
create trigger guard_events
  before insert or update on public.use_case_events
  for each row execute function public.assert_user_owns_use_case();
