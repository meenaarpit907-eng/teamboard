import type { Task, TaskPriority, TaskStatus } from "@/lib/supabase/types";

export const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function sortTasks<T extends Pick<Task, "priority" | "position">>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.position - b.position);
}

export function groupByStatus<T extends Pick<Task, "status" | "priority" | "position">>(
  tasks: T[],
): Record<TaskStatus, T[]> {
  const groups: Record<TaskStatus, T[]> = { todo: [], in_progress: [], done: [] };
  for (const task of tasks) groups[task.status].push(task);
  for (const key of Object.keys(groups) as TaskStatus[]) groups[key] = sortTasks(groups[key]);
  return groups;
}

/**
 * Applies a Realtime postgres_changes event to a local task list. Events can
 * arrive for rows we already have (our own optimistic writes) or out of order,
 * so this is idempotent and keeps the newest `updated_at`.
 */
export function applyTaskChange(
  tasks: Task[],
  change: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Partial<Task>; old: Partial<Task> },
): Task[] {
  if (change.eventType === "DELETE") {
    const id = change.old.id;
    return id ? tasks.filter((t) => t.id !== id) : tasks;
  }
  const incoming = change.new as Task;
  if (!incoming?.id) return tasks;
  const existing = tasks.find((t) => t.id === incoming.id);
  if (!existing) return [...tasks, incoming];
  if (existing.updated_at && incoming.updated_at && existing.updated_at > incoming.updated_at) return tasks;
  return tasks.map((t) => (t.id === incoming.id ? { ...t, ...incoming } : t));
}

export function isOverdue(task: Pick<Task, "due_date" | "status">, today = new Date().toISOString().slice(0, 10)) {
  return task.status !== "done" && task.due_date !== null && task.due_date < today;
}

/** Storage object key for an attachment: <org_id>/<task_id>/<random>-<safe name>. */
export function attachmentPath(orgId: string, taskId: string, fileName: string, random: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return `${orgId}/${taskId}/${random}-${safe || "file"}`;
}
