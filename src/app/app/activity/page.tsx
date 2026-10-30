import { createUserSupabase } from "@/lib/supabase/server";
import { getMembers } from "@/lib/queries";
import { ActivityList } from "@/components/app/activity-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Activity" };

type DigestStats = { tasksCreated?: number; tasksCompleted?: number; comments?: number; activeMembers?: number };

export default async function ActivityPage() {
  const supabase = await createUserSupabase();
  if (!supabase) return null;
  const [{ data: activity }, { data: digests }, members] = await Promise.all([
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("digests").select("*").order("period_end", { ascending: false }).limit(8),
    getMembers(supabase),
  ]);
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Written by database triggers, so every change is recorded no matter which client made it.
          </p>
        </CardHeader>
        <CardContent>
          <ActivityList items={activity ?? []} names={names} />
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Weekly digests</CardTitle>
          <p className="text-sm text-muted-foreground">Generated every Monday by pg_cron and an Edge Function.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(digests ?? []).length === 0 && <p className="text-sm text-muted-foreground">No digests yet.</p>}
          {(digests ?? []).map((d) => {
            const s = d.stats as DigestStats;
            return (
              <div key={d.id} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {new Date(d.period_start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                  {new Date(d.period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p className="mt-1 text-sm">{d.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.tasksCreated ?? 0} created · {s.tasksCompleted ?? 0} completed · {s.comments ?? 0} comments
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
