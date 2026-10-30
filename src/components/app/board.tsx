"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask, updateTask } from "@/app/actions/workspace";
import { useSupabaseBrowser } from "@/lib/supabase/client";
import { applyTaskChange, groupByStatus, isOverdue, STATUSES } from "@/lib/tasks";
import type { Project, Task, TaskStatus } from "@/lib/supabase/types";
import type { Member } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberAvatar } from "@/components/app/member-avatar";
import { TaskSheet } from "@/components/app/task-sheet";
import { PriorityBadge } from "@/components/app/priority-badge";

const PENDING_PREFIX = "pending-";

type Props = {
  project: Project;
  initialTasks: Task[];
  members: Member[];
  currentUserId: string;
  orgId: string;
  isAdmin: boolean;
};

export function Board({ project, initialTasks, members, currentUserId, orgId, isAdmin }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [live, setLive] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const supabase = useSupabaseBrowser();
  // Optimistic cards for tasks being created: shown instantly, replaced by the
  // real row when the Server Action returns (or dropped if it fails).
  const [visibleTasks, addOptimisticTask] = useOptimistic(tasks, (state: Task[], pending: Task) => [...state, pending]);

  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // Realtime: the channel uses the same Clerk token, so Postgres only streams
  // rows this user may SELECT (their active org).
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`project:${project.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${project.id}` },
        (payload) =>
          setTasks((current) =>
            applyTaskChange(current, {
              eventType: payload.eventType,
              new: payload.new as Partial<Task>,
              old: payload.old as Partial<Task>,
            }),
          ),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, project.id]);

  const groups = useMemo(() => groupByStatus(visibleTasks), [visibleTasks]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  function draftTask(title: string, status: TaskStatus): Task {
    const now = new Date().toISOString();
    return {
      id: `${PENDING_PREFIX}${crypto.randomUUID()}`,
      org_id: orgId,
      project_id: project.id,
      title,
      description: null,
      status,
      priority: "medium",
      assignee_id: null,
      due_date: null,
      position: Date.now() / 1000,
      created_by: currentUserId,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };
  }

  function created(task: Task) {
    // Realtime may already have delivered this row; applyTaskChange dedupes by id.
    setTasks((current) => applyTaskChange(current, { eventType: "INSERT", new: task, old: {} }));
  }

  async function move(taskId: string, status: TaskStatus) {
    const before = tasks;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status, position: Date.now() / 1000 } : t)));
    const result = await updateTask({ id: taskId, status });
    if (!result.ok) {
      setTasks(before);
      toast.error(result.error);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/50")} />
        {live ? "Live: changes from teammates appear instantly" : "Connecting to Realtime…"}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map((col) => (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData("text/task-id");
              if (id) void move(id, col.id);
            }}
            className={cn(
              "flex min-h-[320px] flex-col rounded-xl border bg-muted/30 p-3 transition-colors",
              dragOver === col.id && "border-primary/60 bg-primary/5",
            )}
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-medium">{col.label}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {groups[col.id].length}
              </span>
            </header>
            <QuickAdd
              projectId={project.id}
              status={col.id}
              onOptimistic={(title) => addOptimisticTask(draftTask(title, col.id))}
              onCreated={created}
            />
            <ul className="mt-2 flex flex-1 flex-col gap-2">
              {groups[col.id].map((task) => {
                const assignee = task.assignee_id ? memberById.get(task.assignee_id) : undefined;
                const saving = task.id.startsWith(PENDING_PREFIX);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      draggable={!saving}
                      disabled={saving}
                      aria-busy={saving}
                      onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
                      onClick={() => setOpenTaskId(task.id)}
                      className={cn(
                        "w-full cursor-grab rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 active:cursor-grabbing",
                        saving && "cursor-progress opacity-60",
                      )}
                    >
                      <p className={cn("text-sm", task.status === "done" && "text-muted-foreground line-through")}>
                        {task.title}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        {task.due_date && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
                              isOverdue(task) && "text-rose-400",
                            )}
                          >
                            <CalendarDays className="size-3" />
                            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {assignee && <MemberAvatar name={assignee.name} avatarUrl={assignee.avatarUrl} className="ml-auto size-5" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <TaskSheet
        task={openTask}
        onClose={() => setOpenTaskId(null)}
        onLocalChange={(patch) =>
          setTasks((ts) => ts.map((t) => (t.id === openTaskId ? { ...t, ...patch } : t)))
        }
        onDeleted={(id) => {
          setTasks((ts) => ts.filter((t) => t.id !== id));
          setOpenTaskId(null);
        }}
        members={members}
        currentUserId={currentUserId}
        orgId={orgId}
        isAdmin={isAdmin}
      />
    </>
  );
}

function QuickAdd({
  projectId,
  status,
  onOptimistic,
  onCreated,
}: {
  projectId: string;
  status: TaskStatus;
  onOptimistic: (title: string) => void;
  onCreated: (task: Task) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setAdding(true)}>
        <Plus className="size-3.5" /> Add task
      </Button>
    );
  }
  return (
    <form
      action={(form) => {
        const title = String(form.get("title") ?? "").trim();
        if (!title) return;
        form.set("projectId", projectId);
        form.set("status", status);
        // The form resets straight away, so several tasks can be typed in a row
        // while earlier ones are still saving.
        startTransition(async () => {
          onOptimistic(title);
          const result = await createTask(form);
          if (!result.ok || !result.data) return void toast.error(result.ok ? "Something went wrong." : result.error);
          onCreated(result.data.task);
        });
      }}
      className="flex gap-2"
    >
      <Input
        name="title"
        placeholder="Task title"
        autoFocus
        required
        maxLength={200}
        onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
        onBlur={(e) => !e.currentTarget.value && setAdding(false)}
      />
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  );
}
