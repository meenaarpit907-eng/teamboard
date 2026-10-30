// Pure digest logic, shared by the Edge Function and the Vitest suite.
// No Deno or Node APIs here.

export type ActivityRow = {
  org_id: string;
  actor_id: string | null;
  entity: string;
  action: string;
  created_at: string;
};

export type OpenTaskRow = {
  org_id: string;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
};

export type DigestStats = {
  tasksCreated: number;
  tasksCompleted: number;
  comments: number;
  filesAttached: number;
  activeMembers: number;
  openTasks: number;
  overdueTasks: number;
  topContributors: { userId: string; events: number }[];
};

export type Digest = {
  org_id: string;
  period_start: string;
  period_end: string;
  stats: DigestStats;
  summary: string;
};

/** The 7-day window that ends at the most recent Monday 00:00 UTC on or before `now`. */
export function weeklyWindow(now: Date): { start: Date; end: Date } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (end.getUTCDay() + 6) % 7;
  end.setUTCDate(end.getUTCDate() - daysSinceMonday);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function computeStats(activity: ActivityRow[], openTasks: OpenTaskRow[], today: string): DigestStats {
  const perActor = new Map<string, number>();
  let tasksCreated = 0;
  let tasksCompleted = 0;
  let comments = 0;
  let filesAttached = 0;

  for (const row of activity) {
    if (row.entity === "tasks" && row.action === "created") tasksCreated++;
    if (row.entity === "tasks" && row.action === "completed") tasksCompleted++;
    if (row.entity === "task_comments") comments++;
    if (row.entity === "task_attachments" && row.action === "attached_file") filesAttached++;
    if (row.actor_id) perActor.set(row.actor_id, (perActor.get(row.actor_id) ?? 0) + 1);
  }

  const open = openTasks.filter((t) => t.status !== "done");
  const overdueTasks = open.filter((t) => t.due_date !== null && t.due_date < today).length;

  const topContributors = [...perActor.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([userId, events]) => ({ userId, events }));

  return {
    tasksCreated,
    tasksCompleted,
    comments,
    filesAttached,
    activeMembers: perActor.size,
    openTasks: open.length,
    overdueTasks,
    topContributors,
  };
}

export function summarize(stats: DigestStats): string {
  if (stats.activeMembers === 0) {
    return stats.openTasks > 0
      ? `A quiet week: no activity, ${plural(stats.openTasks, "open task")} waiting.`
      : "A quiet week: no activity and nothing open.";
  }
  const parts = [
    `${plural(stats.tasksCreated, "task")} created`,
    `${stats.tasksCompleted} completed`,
    plural(stats.comments, "comment"),
  ];
  if (stats.filesAttached > 0) parts.push(plural(stats.filesAttached, "file") + " attached");
  let text = `${parts.join(", ")} by ${plural(stats.activeMembers, "active member")}.`;
  text += ` ${plural(stats.openTasks, "task")} still open`;
  text += stats.overdueTasks > 0 ? `, ${stats.overdueTasks} overdue.` : ".";
  return text;
}

/** Groups rows by org and builds one digest per org that has any data. */
export function buildDigests(
  activity: ActivityRow[],
  openTasks: OpenTaskRow[],
  window: { start: Date; end: Date },
): Digest[] {
  const orgs = new Set([...activity.map((a) => a.org_id), ...openTasks.map((t) => t.org_id)]);
  const today = window.end.toISOString().slice(0, 10);
  return [...orgs].sort().map((org_id) => {
    const stats = computeStats(
      activity.filter((a) => a.org_id === org_id),
      openTasks.filter((t) => t.org_id === org_id),
      today,
    );
    return {
      org_id,
      period_start: window.start.toISOString(),
      period_end: window.end.toISOString(),
      stats,
      summary: summarize(stats),
    };
  });
}

/** Constant-time comparison of the shared cron secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
