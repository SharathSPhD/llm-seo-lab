-- llm-seo-lab v0.3.0 — RLS deny-test
-- Spec: docs/v0.3.0/spec.md §4 (RLS template + deny-test)
--
-- Run with `psql -f infra/supabase/tests/rls.test.sql` against a Supabase
-- project that has applied 0001_init.sql. The test impersonates two
-- distinct authenticated users via `set local "request.jwt.claim.sub"`
-- and asserts that user B cannot select user A's rows.
--
-- The script uses RAISE NOTICE plus DO blocks so it works with plain
-- `psql` and emits a non-zero exit code via RAISE EXCEPTION on failure.

begin;

-- Two synthetic users. We insert them directly into auth.users for the
-- test. In production, Supabase magic-link creates these.
insert into auth.users (id, email, instance_id)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

-- Impersonate user A and write a use case.
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

insert into public.use_cases (id, user_id, url, substrate, title, topic)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'https://a.example.com/p1',
  'web',
  'A test',
  'A topic'
);

-- Impersonate user B and assert deny.
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

do $$
declare
  visible_count int;
begin
  select count(*) into visible_count
  from public.use_cases
  where id = '33333333-3333-3333-3333-333333333333';
  if visible_count <> 0 then
    raise exception 'RLS DENY-TEST FAILED: user B saw % rows of user A''s use_cases', visible_count;
  else
    raise notice 'RLS DENY-TEST PASS: user B sees 0 rows of user A''s use_cases';
  end if;
end $$;

-- Also assert user B cannot insert a recommendation against user A's use case.
do $$
begin
  begin
    insert into public.recommendations (
      use_case_id, user_id, iteration, triz_principle, applicability_score,
      knob, diff_summary, payload, rationale, expected_engines
    ) values (
      '33333333-3333-3333-3333-333333333333',
      '22222222-2222-2222-2222-222222222222',
      0,
      'atomic-snippet-density',
      0.5,
      'json_ld_faqpage',
      'attempted cross-user write',
      '{}'::jsonb,
      'should be rejected',
      array['chatgpt']
    );
    raise exception 'RLS DENY-TEST FAILED: user B inserted into user A''s use case';
  exception
    when others then
      raise notice 'RLS DENY-TEST PASS: user B insert blocked (% / %)', sqlstate, sqlerrm;
  end;
end $$;

rollback;
