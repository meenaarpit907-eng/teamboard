-- =============================================================================
-- TeamBoard core schema
--
-- Identity lives in Clerk. Supabase is configured with Clerk as a third-party
-- auth provider, so every PostgREST / Realtime / Storage request carries a
-- Clerk session token and auth.jwt() exposes its claims:
--
--   sub              Clerk user id (user_...)            -- text, NOT a uuid
--   role             "authenticated" (added by Clerk's Supabase integration)
--   o.id / o.rol     active organization id / role       -- session token v2
--   org_id/org_role  same, for v1 tokens or custom JWT templates
--
-- Tenancy rule: a request can only ever see rows of the organization that is
-- *active in its token*. Switching orgs in the Clerk <OrganizationSwitcher />
-- mints a new token, so isolation does not depend on any app-side filtering.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- JWT helpers. Stable + security invoker; they only read the request's claims.
-- -----------------------------------------------------------------------------

create or replace function private.clerk_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function private.active_org_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(coalesce(auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'org_id'), '');
$$;

-- Normalised role of the caller in the active org: 'admin' | 'member' | other
-- custom role keys, with Clerk's "org:" prefix stripped.
create or replace function private.active_org_role()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    regexp_replace(coalesce(auth.jwt() -> 'o' ->> 'rol', auth.jwt() ->> 'org_role', ''), '^org:', ''),
    ''
  );
$$;

-- True when the caller is signed in and `org` is their active organization.
create or replace function private.is_org_member(org text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() ->> 'role') = 'authenticated'
    and private.clerk_user_id() is not null
    and org is not null
    and org = private.active_org_id(),
    false
  );
$$;

create or replace function private.is_org_admin(org text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_org_member(org) and coalesce(private.active_org_role() = 'admin', false);
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- Generic updated_at trigger.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables synced from Clerk webhooks (written only with the service role).
-- -----------------------------------------------------------------------------

create table public.organizations (
  id text primary key check (id ~ '^org_[A-Za-z0-9]+$'),
  name text not null check (char_length(name) between 1 and 200),
  slug text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.organizations is 'Mirror of Clerk organizations, kept in sync by the /api/webhooks/clerk route.';

create table public.profiles (
  id text primary key check (id ~ '^user_[A-Za-z0-9]+$'),
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Mirror of Clerk users (display data only). Synced by webhook.';

create table public.memberships (
  org_id text not null references public.organizations (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);
comment on table public.memberships is 'Mirror of Clerk organization memberships. Used for display (assignees, people list); authorization uses the token claims.';

-- -----------------------------------------------------------------------------
-- Tenant data. org_id defaults to the caller's active org, created_by to sub,
-- so clients never send them and RLS re-checks them anyway.
-- -----------------------------------------------------------------------------

create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default private.active_org_id(),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  color text not null default 'violet' check (color in ('violet', 'emerald', 'sky', 'amber', 'rose', 'slate')),
  archived boolean not null default false,
  created_by text not null default private.clerk_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index projects_org_id_idx on public.projects (org_id) where not archived;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default private.active_org_id(),
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 10000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  assignee_id text,
  due_date date,
  position double precision not null default extract(epoch from clock_timestamp()),
  created_by text not null default private.clerk_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, org_id),
  -- Composite FK: a task can only point at a project of the SAME org.
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);
create index tasks_org_project_idx on public.tasks (org_id, project_id, status, position);
create index tasks_assignee_idx on public.tasks (assignee_id) where assignee_id is not null;

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default private.active_org_id(),
  task_id uuid not null,
  author_id text not null default private.clerk_user_id(),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (task_id, org_id) references public.tasks (id, org_id) on delete cascade
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default private.active_org_id(),
  task_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text,
  size_bytes bigint check (size_bytes >= 0),
  uploaded_by text not null default private.clerk_user_id(),
  created_at timestamptz not null default now(),
  foreign key (task_id, org_id) references public.tasks (id, org_id) on delete cascade,
  -- Storage objects live under <org_id>/<task_id>/...; keep metadata honest.
  check (storage_path like org_id || '/' || task_id::text || '/%')
);
create index task_attachments_task_idx on public.task_attachments (task_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  org_id text not null,
  actor_id text,
  entity text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_log_org_created_idx on public.activity_log (org_id, created_at desc);

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  stats jsonb not null,
  summary text not null,
  created_at timestamptz not null default now(),
  unique (org_id, period_start)
);
create index digests_org_idx on public.digests (org_id, period_end desc);
comment on table public.digests is 'Weekly activity summaries written by the weekly-digest Edge Function (service role).';

-- updated_at triggers
create trigger organizations_touch before update on public.organizations for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger memberships_touch before update on public.memberships for each row execute function private.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function private.touch_updated_at();

-- completed_at bookkeeping
create or replace function private.tasks_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_completed_at before insert or update of status on public.tasks
  for each row execute function private.tasks_completed_at();

-- Immutable tenancy/authorship columns: nobody (except the service role)
-- can move a row to another org or rewrite who created it.
create or replace function private.protect_owner_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable' using errcode = '42501';
  end if;
  if tg_table_name in ('projects', 'tasks') and new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger projects_protect before update on public.projects for each row execute function private.protect_owner_columns();
create trigger tasks_protect before update on public.tasks for each row execute function private.protect_owner_columns();

-- -----------------------------------------------------------------------------
-- Activity log, written by triggers (security definer: clients have no write
-- path to activity_log at all).
-- -----------------------------------------------------------------------------

create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := private.clerk_user_id();
  row_data record;
  verb text;
  text_summary text;
begin
  if tg_op = 'DELETE' then
    row_data := old;
  else
    row_data := new;
  end if;

  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      verb := 'created';
      text_summary := format('created task "%s"', new.title);
    elsif tg_op = 'DELETE' then
      verb := 'deleted';
      text_summary := format('deleted task "%s"', old.title);
    elsif new.status is distinct from old.status then
      verb := case when new.status = 'done' then 'completed' else 'status_changed' end;
      text_summary := format('moved "%s" to %s', new.title, replace(new.status::text, '_', ' '));
    elsif new.assignee_id is distinct from old.assignee_id then
      verb := 'assigned';
      text_summary := format('changed the assignee of "%s"', new.title);
    else
      verb := 'updated';
      text_summary := format('updated task "%s"', new.title);
    end if;
  elsif tg_table_name = 'projects' then
    verb := case tg_op when 'INSERT' then 'created' when 'DELETE' then 'deleted' else 'updated' end;
    if tg_op = 'UPDATE' and new.archived and not old.archived then
      verb := 'archived';
    end if;
    text_summary := format('%s project "%s"', verb, row_data.name);
  elsif tg_table_name = 'task_comments' then
    verb := 'commented';
    text_summary := 'commented on a task';
  elsif tg_table_name = 'task_attachments' then
    verb := case when tg_op = 'DELETE' then 'removed_file' else 'attached_file' end;
    text_summary := format('%s "%s"', case when tg_op = 'DELETE' then 'removed file' else 'attached' end, row_data.file_name);
  else
    return null;
  end if;

  insert into public.activity_log (org_id, actor_id, entity, entity_id, action, summary)
  values (row_data.org_id, actor, tg_table_name, row_data.id, verb, text_summary);
  return null;
end;
$$;
revoke all on function private.log_activity() from public, anon, authenticated;

create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function private.log_activity();
create trigger projects_activity after insert or update or delete on public.projects
  for each row execute function private.log_activity();
create trigger task_comments_activity after insert on public.task_comments
  for each row execute function private.log_activity();
create trigger task_attachments_activity after insert or delete on public.task_attachments
  for each row execute function private.log_activity();

-- Assignees must belong to the task's organization (per the webhook-synced
-- memberships), so a task can never reference a user from another tenant.
create or replace function private.check_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.memberships m
    where m.org_id = new.org_id and m.user_id = new.assignee_id
  ) then
    raise exception 'assignee % is not a member of this organization', new.assignee_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function private.check_task_assignee() from public, anon, authenticated;
create trigger tasks_check_assignee before insert or update of assignee_id on public.tasks
  for each row execute function private.check_task_assignee();
