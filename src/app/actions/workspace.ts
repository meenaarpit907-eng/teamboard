"use server";

import { revalidatePath } from "next/cache";
import { createUserSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Task, TaskComment } from "@/lib/supabase/types";
import {
  attachmentSchema,
  commentSchema,
  formToObject,
  projectSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "@/lib/validation";

/**
 * Server Actions. Each one runs as the signed-in Clerk user via
 * createUserSupabase(), so RLS is the authority: these checks only produce
 * friendlier errors, they are not the security boundary.
 */

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function context() {
  const ctx = await getWorkspaceContext();
  const supabase = await createUserSupabase();
  if (!ctx) return { error: "Select an organization first." } as const;
  if (!supabase) return { error: "Supabase is not configured." } as const;
  return { ctx, supabase } as const;
}

function friendly(message: string): string {
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that.";
  if (/not a member/i.test(message)) return "That person isn't a member of this organization.";
  return "Something went wrong. Please try again.";
}

export async function createProject(form: FormData): Promise<ActionResult<{ id: string }>> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  if (!c.ctx.isAdmin) return { ok: false, error: "Only organization admins can create projects." };
  const parsed = projectSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, error: "Give the project a name (max 120 characters)." };

  const { data, error } = await c.supabase.from("projects").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/app");
  return { ok: true, data: { id: data.id } };
}

export async function archiveProject(projectId: string): Promise<ActionResult> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const { data, error } = await c.supabase
    .from("projects")
    .update({ archived: true })
    .eq("id", projectId)
    .select("id");
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "Only organization admins can archive projects." };
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Returns the full inserted row so the board can swap its optimistic card for
 * the real one immediately. No revalidatePath/router.refresh here: re-rendering
 * the whole project page (5 RLS queries) after every insert was the main cause
 * of the 5-10 s delay. Other members get the row via Realtime.
 */
export async function createTask(form: FormData): Promise<ActionResult<{ task: Task }>> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const parsed = taskCreateSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, error: "Check the task title and fields." };
  const t = parsed.data;
  const { data, error } = await c.supabase
    .from("tasks")
    .insert({
      project_id: t.projectId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assignee_id: t.assigneeId ?? null,
      due_date: t.dueDate ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: { task: data } };
}

export async function updateTask(input: unknown): Promise<ActionResult> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid task update." };
  const { id, assigneeId, dueDate, ...rest } = parsed.data;
  const patch: Partial<Task> = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.description !== undefined) patch.description = rest.description;
  if (rest.priority !== undefined) patch.priority = rest.priority;
  if (rest.status !== undefined) patch.status = rest.status;
  if (assigneeId !== undefined) patch.assignee_id = assigneeId;
  if (dueDate !== undefined) patch.due_date = dueDate;

  const { data, error } = await c.supabase.from("tasks").update(patch).eq("id", id).select("id");
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "Task not found." };
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const { data, error } = await c.supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "Only admins or the task's creator can delete it." };
  return { ok: true };
}

export async function addComment(input: unknown): Promise<ActionResult<{ comment: TaskComment }>> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a comment first." };
  const { data, error } = await c.supabase
    .from("task_comments")
    .insert({ task_id: parsed.data.taskId, body: parsed.data.body })
    .select("*")
    .single();
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: { comment: data } };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const { data, error } = await c.supabase.from("task_comments").delete().eq("id", commentId).select("id");
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "You can only delete your own comments." };
  return { ok: true };
}

/** Records metadata after the browser uploaded the object straight to Storage. */
export async function recordAttachment(input: unknown): Promise<ActionResult> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid attachment." };
  const a = parsed.data;
  if (!a.storagePath.startsWith(`${c.ctx.orgId}/${a.taskId}/`)) return { ok: false, error: "Invalid attachment path." };
  const { error } = await c.supabase.from("task_attachments").insert({
    task_id: a.taskId,
    storage_path: a.storagePath,
    file_name: a.fileName,
    content_type: a.contentType ?? null,
    size_bytes: a.sizeBytes,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true };
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const c = await context();
  if ("error" in c) return { ok: false, error: c.error! };
  const { data, error } = await c.supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("storage_path");
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "Only admins or the uploader can remove a file." };
  // Storage RLS applies the same rule to the object itself.
  await c.supabase.storage.from("attachments").remove([data[0].storage_path]);
  return { ok: true };
}
