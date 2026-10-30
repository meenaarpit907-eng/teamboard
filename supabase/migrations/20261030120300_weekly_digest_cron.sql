-- =============================================================================
-- Weekly digest schedule: pg_cron -> pg_net -> Edge Function `weekly-digest`.
--
-- The function URL and a shared secret are read from Supabase Vault at run
-- time, so nothing sensitive lives in this migration. Create them once:
--
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random string>', 'digest_cron_secret');
--
-- and set the same secret on the function:
--   supabase secrets set DIGEST_CRON_SECRET=<random string>
--
-- Runs every Monday 03:00 UTC (08:30 IST).
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_weekly_digest()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret text;
  request_id bigint;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'digest_cron_secret';
  if base_url is null or secret is null then
    raise warning 'weekly digest skipped: vault secrets project_url / digest_cron_secret are not set';
    return null;
  end if;

  select net.http_post(
    url := base_url || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 15000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.invoke_weekly_digest() from public, anon, authenticated;

select cron.schedule(
  'teamboard-weekly-digest',
  '0 3 * * 1',
  $$ select private.invoke_weekly_digest(); $$
);
