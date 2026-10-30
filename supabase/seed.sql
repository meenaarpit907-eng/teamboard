-- =============================================================================
-- Local development / test seed. Fictional data only.
--
-- IDs are fake Clerk IDs, so this data is invisible to real Clerk sessions on
-- a hosted project (RLS matches the token's org id). It exists so that
-- `supabase db reset`, the pgTAP suite and the Vitest RLS suite have two
-- tenants to prove isolation against.
--
--   org_seedAcme    user_seedAlice (admin), user_seedBob (member)
--   org_seedGlobex  user_seedCarol (admin)
-- =============================================================================

insert into public.organizations (id, name, slug) values
  ('org_seedAcme', 'Acme Studio', 'acme-studio'),
  ('org_seedGlobex', 'Globex Labs', 'globex-labs')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name) values
  ('user_seedAlice', 'alice@example.com', 'Alice Example'),
  ('user_seedBob', 'bob@example.com', 'Bob Example'),
  ('user_seedCarol', 'carol@example.com', 'Carol Example')
on conflict (id) do nothing;

insert into public.memberships (org_id, user_id, role) values
  ('org_seedAcme', 'user_seedAlice', 'admin'),
  ('org_seedAcme', 'user_seedBob', 'member'),
  ('org_seedGlobex', 'user_seedCarol', 'admin')
on conflict do nothing;

insert into public.projects (id, org_id, name, description, color, created_by) values
  ('11111111-1111-4111-8111-111111111111', 'org_seedAcme', 'Website relaunch', 'New marketing site on Next.js + Vercel.', 'violet', 'user_seedAlice'),
  ('22222222-2222-4222-8222-222222222222', 'org_seedAcme', 'Customer portal', 'Self-serve portal backed by Supabase.', 'emerald', 'user_seedAlice'),
  ('33333333-3333-4333-8333-333333333333', 'org_seedGlobex', 'Data platform', 'Internal analytics workspace.', 'sky', 'user_seedCarol')
on conflict (id) do nothing;

insert into public.tasks (id, org_id, project_id, title, status, priority, assignee_id, created_by) values
  ('aaaaaaa1-0000-4000-8000-000000000001', 'org_seedAcme', '11111111-1111-4111-8111-111111111111', 'Design system tokens', 'done', 'high', 'user_seedAlice', 'user_seedAlice'),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'org_seedAcme', '11111111-1111-4111-8111-111111111111', 'Hero section copy', 'in_progress', 'medium', 'user_seedBob', 'user_seedAlice'),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'org_seedAcme', '11111111-1111-4111-8111-111111111111', 'Set up preview deployments', 'todo', 'urgent', null, 'user_seedBob'),
  ('aaaaaaa1-0000-4000-8000-000000000004', 'org_seedAcme', '22222222-2222-4222-8222-222222222222', 'Org-scoped RLS policies', 'todo', 'high', 'user_seedAlice', 'user_seedAlice'),
  ('bbbbbbb1-0000-4000-8000-000000000001', 'org_seedGlobex', '33333333-3333-4333-8333-333333333333', 'Ingest pipeline', 'in_progress', 'medium', 'user_seedCarol', 'user_seedCarol')
on conflict (id) do nothing;

insert into public.task_comments (org_id, task_id, author_id, body) values
  ('org_seedAcme', 'aaaaaaa1-0000-4000-8000-000000000002', 'user_seedBob', 'First draft is in the doc.'),
  ('org_seedGlobex', 'bbbbbbb1-0000-4000-8000-000000000001', 'user_seedCarol', 'Blocked on credentials.');
