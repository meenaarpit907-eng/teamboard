-- =============================================================================
-- Realtime + Storage
-- =============================================================================

-- Realtime: postgres_changes on these tables are delivered only to clients
-- whose Clerk token passes the SELECT policies above, so a subscriber never
-- receives another organization's events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.task_comments, public.activity_log;
  end if;
end;
$$;

-- Old row values are needed to route UPDATE/DELETE events.
alter table public.tasks replica identity full;

-- Storage: private bucket, objects stored as <org_id>/<task_id>/<file>.
-- The first path segment is the tenant boundary.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('attachments', 'attachments', false, 10485760)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    create policy "Members read their org's attachments"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'attachments'
        and (select private.is_org_member((storage.foldername(name))[1]))
      );

    create policy "Members upload to tasks of their org"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'attachments'
        and (select private.is_org_member((storage.foldername(name))[1]))
        and exists (
          select 1 from public.tasks t
          where t.id::text = (storage.foldername(name))[2]
            and t.org_id = (storage.foldername(name))[1]
        )
      );

    create policy "Admins or uploaders delete attachments"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'attachments'
        and (
          (select private.is_org_admin((storage.foldername(name))[1]))
          or (
            (select private.is_org_member((storage.foldername(name))[1]))
            and owner_id = (select private.clerk_user_id())
          )
        )
      );
  end if;
end;
$$;
