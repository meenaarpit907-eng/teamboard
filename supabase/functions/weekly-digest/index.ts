// weekly-digest: builds a per-organization activity summary for the last
// week and stores it in public.digests. Invoked every Monday by pg_cron
// (see supabase/migrations/*_weekly_digest_cron.sql) with a shared secret.
//
// Uses the service role because it aggregates across all tenants; it writes
// only to public.digests, which members can read through RLS.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildDigests, safeEqual, weeklyWindow, type ActivityRow, type OpenTaskRow } from "./lib.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("DIGEST_CRON_SECRET") ?? "";
  const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(provided, expected)) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const window = weeklyWindow(new Date());

  const [activity, open] = await Promise.all([
    supabase
      .from("activity_log")
      .select("org_id, actor_id, entity, action, created_at")
      .gte("created_at", window.start.toISOString())
      .lt("created_at", window.end.toISOString())
      .limit(50_000),
    supabase.from("tasks").select("org_id, due_date, status").neq("status", "done").limit(50_000),
  ]);
  if (activity.error || open.error) {
    console.error("[weekly-digest] query failed", activity.error ?? open.error);
    return json({ error: "query failed" }, 500);
  }

  const digests = buildDigests(activity.data as ActivityRow[], open.data as OpenTaskRow[], window);
  if (digests.length > 0) {
    const { error } = await supabase.from("digests").upsert(digests, { onConflict: "org_id,period_start" });
    if (error) {
      console.error("[weekly-digest] upsert failed", error);
      return json({ error: "write failed" }, 500);
    }
  }

  return json({ ok: true, organizations: digests.length, period_start: window.start, period_end: window.end });
});
