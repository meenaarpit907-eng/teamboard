import Link from "next/link";
import { CheckCircle2, CircleDot, Clock3, FolderKanban, Users } from "lucide-react";
import { createUserSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { getMembers } from "@/lib/queries";
import { isOverdue } from "@/lib/tasks";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { ActivityList } from "@/components/app/activity-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROJECT_COLORS } from "@/components/app/project-colors";

export default async function DashboardPage() {
  const ctx = await getWorkspaceContext();
  const supabase = await createUserSupabase();
  if (!ctx || !supabase) return null;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [projectsRes, tasksRes, activityRes, digestRes, members] = await Promise.all([
    supabase.from("projects").select("*").eq("archived", false).order("created_at", { ascending: true }),
    supabase.from("tasks").select("id, project_id, status, due_date, completed_at"),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("digests").select("*").order("period_end", { ascending: false }).limit(1).maybeSingle(),
    getMembers(supabase),
  ]);

  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const open = tasks.filter((t) => t.status !== "done");
  const doneThisWeek = tasks.filter((t) => t.completed_at && t.completed_at >= weekAgo).length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));

  const stats = [
    { label: "Open tasks", value: open.length, icon: CircleDot },
    { label: "Done in 7 days", value: doneThisWeek, icon: CheckCircle2 },
    { label: "Overdue", value: overdue, icon: Clock3 },
    { label: "Members synced", value: members.length, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You are {ctx.isAdmin ? "an admin" : "a member"} of this organization.
            {!ctx.isAdmin && " Only admins can create projects."}
          </p>
        </div>
        {ctx.isAdmin && <NewProjectDialog />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="gap-2 py-4">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <Icon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          {projects.length === 0 ? (
            <Card className="items-center py-16 text-center">
              <FolderKanban className="size-10 text-muted-foreground" />
              <CardTitle>No projects yet</CardTitle>
              <p className="max-w-sm text-sm text-muted-foreground">
                {ctx.isAdmin
                  ? "Create the first project for this organization."
                  : "Ask an admin of this organization to create a project."}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => {
                const pt = tasks.filter((t) => t.project_id === p.id);
                const done = pt.filter((t) => t.status === "done").length;
                const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
                const color = PROJECT_COLORS[p.color];
                return (
                  <Link key={p.id} href={`/app/projects/${p.id}`} className="group">
                    <Card className="h-full gap-4 transition-colors group-hover:border-primary/40">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <span className={`size-2.5 rounded-full ${color.dot}`} />
                          <CardTitle className="truncate">{p.name}</CardTitle>
                        </div>
                        {p.description && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="mt-auto space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {done}/{pt.length} done
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card className="gap-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Weekly digest</CardTitle>
                <Badge variant="secondary">Edge Function</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {digestRes.data ? (
                <>
                  <p className="text-foreground">{digestRes.data.summary}</p>
                  <p className="mt-2 text-xs">
                    Week ending {new Date(digestRes.data.period_end).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </p>
                </>
              ) : (
                <p>The first digest is generated on Monday by pg_cron.</p>
              )}
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={activityRes.data ?? []} names={names} compact />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
