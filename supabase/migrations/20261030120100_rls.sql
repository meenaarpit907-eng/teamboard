-- =============================================================================
-- Row Level Security
--
-- Every table has RLS enabled and no policy for `anon`, so the publishable key
-- alone reads nothing. Policies only consult the verified Clerk token:
--
--   read          any member of the row's org (= the caller's ACTIVE org)
--   tasks         members create/update; delete = admin or task creator
--   comments      members create as themselves; delete = admin or author
--   attachments   members upload as themselves; delete = admin or uploader
--   projects      admins create/update/delete (role-based write rule)
--   mirrors       organizations/profiles/memberships: read-only for members,
--                 written by the Clerk webhook with the service role
--   activity_log  read-only; written by security-definer triggers
--   digests       read-only; written by the weekly-digest Edge Function
--
-- auth.jwt() calls are wrapped in (select ...) inside helpers so Postgres
-- evaluates them once per statement, not once per row.
-- =============================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.activity_log enable row level security;
alter table public.digests enable row level security;

-- Least privilege at the GRANT level too: anon gets nothing, authenticated
-- gets only the verbs some policy can allow.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations, public.profiles, public.memberships,
  public.activity_log, public.digests to authenticated;
grant select, insert, update, delete on public.projects, public.tasks to authenticated;
grant select, insert, delete on public.task_comments, public.task_attachments to authenticated;
grant all on all tables in schema public to service_role;

-- organizations ---------------------------------------------------------------
create policy "Members read their active organization"
  on public.organizations for select to authenticated
  using ((select private.is_org_member(id)));

-- profiles --------------------------------------------------------------------
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select private.clerk_user_id()));

create policy "Members read profiles of people in their active organization"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id
        and m.org_id = (select private.active_org_id())
    )
    and (select private.is_org_member(private.active_org_id()))
  );

-- memberships -----------------------------------------------------------------
create policy "Members read memberships of their active organization"
  on public.memberships for select to authenticated
  using ((select private.is_org_member(org_id)));

-- projects --------------------------------------------------------------------
create policy "Members read projects"
  on public.projects for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy "Admins create projects"
  on public.projects for insert to authenticated
  with check (
    (select private.is_org_admin(org_id))
    and created_by = (select private.clerk_user_id())
  );

create policy "Admins update projects"
  on public.projects for update to authenticated
  using ((select private.is_org_admin(org_id)))
  with check ((select private.is_org_admin(org_id)));

create policy "Admins delete projects"
  on public.projects for delete to authenticated
  using ((select private.is_org_admin(org_id)));

-- tasks -----------------------------------------------------------------------
create policy "Members read tasks"
  on public.tasks for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy "Members create tasks"
  on public.tasks for insert to authenticated
  with check (
    (select private.is_org_member(org_id))
    and created_by = (select private.clerk_user_id())
  );

create policy "Members update tasks"
  on public.tasks for update to authenticated
  using ((select private.is_org_member(org_id)))
  with check ((select private.is_org_member(org_id)));

create policy "Admins or creators delete tasks"
  on public.tasks for delete to authenticated
  using (
    (select private.is_org_admin(org_id))
    or ((select private.is_org_member(org_id)) and created_by = (select private.clerk_user_id()))
  );

-- task_comments ---------------------------------------------------------------
create policy "Members read comments"
  on public.task_comments for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy "Members comment as themselves"
  on public.task_comments for insert to authenticated
  with check (
    (select private.is_org_member(org_id))
    and author_id = (select private.clerk_user_id())
  );

create policy "Admins or authors delete comments"
  on public.task_comments for delete to authenticated
  using (
    (select private.is_org_admin(org_id))
    or ((select private.is_org_member(org_id)) and author_id = (select private.clerk_user_id()))
  );

-- task_attachments ------------------------------------------------------------
create policy "Members read attachments"
  on public.task_attachments for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy "Members attach files as themselves"
  on public.task_attachments for insert to authenticated
  with check (
    (select private.is_org_member(org_id))
    and uploaded_by = (select private.clerk_user_id())
  );

create policy "Admins or uploaders delete attachments"
  on public.task_attachments for delete to authenticated
  using (
    (select private.is_org_admin(org_id))
    or ((select private.is_org_member(org_id)) and uploaded_by = (select private.clerk_user_id()))
  );

-- activity_log / digests --------------------------------------------------------
create policy "Members read activity"
  on public.activity_log for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy "Members read digests"
  on public.digests for select to authenticated
  using ((select private.is_org_member(org_id)));
