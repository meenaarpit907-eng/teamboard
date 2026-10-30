-- Minimal stand-in for the pieces of a Supabase database that the migrations
-- rely on, so RLS can be exercised in-process with PGlite (no Docker).
-- The real thing is covered by the pgTAP suite in supabase/tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', current_user::text);
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
