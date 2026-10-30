-- pgTAP suite for TeamBoard's multi-tenant RLS. Run with `supabase test db`
-- (after `supabase start`); uses the fictional tenants from supabase/seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Every public table has RLS on.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every table in public has row level security enabled'
);

select policies_are('public', 'tasks', array[
  'Members read tasks', 'Members create tasks', 'Members update tasks', 'Admins or creators delete tasks'
]);

-- Helper to impersonate a Clerk session token (session token v2 "o" claim).
create or replace function pg_temp.as_clerk(sub text, org text, rol text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', sub, 'role', 'authenticated', 'o', json_build_object('id', org, 'rol', rol)
  )::text, true);
  execute 'set local role authenticated';
end;
$$;

-- anon ----------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.tasks', '42501', null, 'anon cannot read tasks');
reset role;

-- Bob (member of Acme) --------------------------------------------------------
select pg_temp.as_clerk('user_seedBob', 'org_seedAcme', 'member');
select is((select count(*)::int from public.tasks), 4, 'Bob sees the 4 Acme tasks');
select is((select count(*)::int from public.tasks where org_id <> 'org_seedAcme'), 0, 'Bob sees no Globex tasks');
select is((select count(*)::int from public.task_comments), 1, 'Bob sees only Acme comments');
select throws_ok(
  $$ insert into public.projects (name) values ('Member project') $$,
  '42501', null, 'members cannot create projects'
);
select lives_ok(
  $$ insert into public.tasks (project_id, title) values ('11111111-1111-4111-8111-111111111111', 'From Bob') $$,
  'members can create tasks'
);
select is(
  (select created_by from public.tasks where title = 'From Bob'), 'user_seedBob',
  'created_by is filled from the token'
);
select throws_ok(
  $$ insert into public.tasks (org_id, project_id, title) values ('org_seedGlobex', '33333333-3333-4333-8333-333333333333', 'sneaky') $$,
  null, null, 'members cannot write into another org'
);
select is_empty(
  $$ delete from public.tasks where id = 'aaaaaaa1-0000-4000-8000-000000000001' returning id $$,
  'members cannot delete tasks created by someone else'
);
reset role;

-- Alice (admin of Acme) -------------------------------------------------------
select pg_temp.as_clerk('user_seedAlice', 'org_seedAcme', 'admin');
select lives_ok($$ insert into public.projects (name) values ('Admin project') $$, 'admins can create projects');
select isnt_empty(
  $$ delete from public.tasks where id = 'aaaaaaa1-0000-4000-8000-000000000001' returning id $$,
  'admins can delete any task in their org'
);
select throws_ok(
  $$ update public.projects set org_id = 'org_seedGlobex' where id = '11111111-1111-4111-8111-111111111111' $$,
  null, null, 'org_id is immutable'
);
reset role;

-- Carol (admin of Globex) -----------------------------------------------------
select pg_temp.as_clerk('user_seedCarol', 'org_seedGlobex', 'admin');
select is((select count(*)::int from public.projects), 1, 'Carol sees only the Globex project');
select is_empty(
  $$ update public.tasks set title = 'pwned' where org_id = 'org_seedAcme' returning id $$,
  'admins of one org cannot touch another org'
);
reset role;

select * from finish();
rollback;
