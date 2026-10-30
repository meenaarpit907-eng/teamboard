"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Download, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addComment,
  deleteAttachment,
  deleteComment,
  deleteTask,
  recordAttachment,
  updateTask,
} from "@/app/actions/workspace";
import { useSupabaseBrowser } from "@/lib/supabase/client";
import { attachmentPath, PRIORITIES, STATUSES } from "@/lib/tasks";
import type { Task, TaskAttachment, TaskComment, TaskPriority, TaskStatus } from "@/lib/supabase/types";
import type { Member } from "@/lib/queries";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { MemberAvatar } from "@/components/app/member-avatar";
import { timeAgo } from "@/components/app/activity-list";

type Props = {
  task: Task | null;
  onClose: () => void;
  onLocalChange: (patch: Partial<Task>) => void;
  onDeleted: (id: string) => void;
  members: Member[];
  currentUserId: string;
  orgId: string;
  isAdmin: boolean;
};

const UNASSIGNED = "__unassigned";
const MAX_BYTES = 10 * 1024 * 1024;

export function TaskSheet({ task, onClose, onLocalChange, onDeleted, members, currentUserId, orgId, isAdmin }: Props) {
  const supabase = useSupabaseBrowser();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const taskId = task?.id;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "A member";

  const load = useCallback(async () => {
    if (!supabase || !taskId) return;
    const [c, f] = await Promise.all([
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at"),
    ]);
    setComments(c.data ?? []);
    setFiles(f.data ?? []);
  }, [supabase, taskId]);

  useEffect(() => {
    setComments([]);
    setFiles([]);
    void load();
    if (!supabase || !taskId) return;
    const channel = supabase
      .channel(`task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, taskId, load]);

  function save(patch: Record<string, unknown>, local: Partial<Task>) {
    if (!task) return;
    onLocalChange(local);
    startTransition(async () => {
      const result = await updateTask({ id: task.id, ...patch });
      if (!result.ok) toast.error(result.error);
    });
  }

  async function upload(file: File) {
    if (!supabase || !task) return;
    if (file.size > MAX_BYTES) return void toast.error("Files can be up to 10 MB.");
    setUploading(true);
    try {
      const path = attachmentPath(orgId, task.id, file.name, crypto.randomUUID().slice(0, 8));
      // Direct browser -> Storage upload; storage.objects RLS checks that the
      // first path segment is the caller's active org.
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const result = await recordAttachment({
        taskId: task.id,
        storagePath: path,
        fileName: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
      });
      if (!result.ok) throw new Error(result.error);
      toast.success("File attached");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function download(file: TaskAttachment) {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(file.storage_path, 60);
    if (error || !data) return void toast.error("Couldn't create a download link.");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const canDelete = task && (isAdmin || task.created_by === currentUserId);

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {task && (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Task details</SheetTitle>
              <SheetDescription className="sr-only">Edit the task, comment and attach files.</SheetDescription>
              <Input
                key={task.id + task.title}
                defaultValue={task.title}
                maxLength={200}
                aria-label="Title"
                className="border-none bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                onBlur={(e) => {
                  const title = e.currentTarget.value.trim();
                  if (title && title !== task.title) save({ title }, { title });
                }}
              />
            </SheetHeader>
            <div className="space-y-6 px-4 pb-8">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select value={task.status} onValueChange={(v) => save({ status: v }, { status: v as TaskStatus })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select value={task.priority} onValueChange={(v) => save({ priority: v }, { priority: v as TaskPriority })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Assignee">
                  <Select
                    value={task.assignee_id ?? UNASSIGNED}
                    onValueChange={(v) => {
                      const assigneeId = v === UNASSIGNED ? null : v;
                      save({ assigneeId }, { assignee_id: assigneeId });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Due date">
                  <Input
                    type="date"
                    key={task.id + (task.due_date ?? "")}
                    defaultValue={task.due_date ?? ""}
                    onChange={(e) => {
                      const dueDate = e.currentTarget.value || null;
                      save({ dueDate }, { due_date: dueDate });
                    }}
                  />
                </Field>
              </div>

              <Field label="Description">
                <Textarea
                  key={task.id}
                  defaultValue={task.description ?? ""}
                  rows={5}
                  maxLength={10000}
                  placeholder="Add more detail…"
                  onBlur={(e) => {
                    const description = e.currentTarget.value.trim() || null;
                    if (description !== task.description) save({ description }, { description });
                  }}
                />
              </Field>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Files</h3>
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    <Paperclip className="size-3.5" /> {uploading ? "Uploading…" : "Attach"}
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
                  />
                </div>
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No files yet. Stored privately under this organization.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {files.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                        <span className="text-xs text-muted-foreground">{formatBytes(f.size_bytes)}</span>
                        <Button variant="ghost" size="icon-xs" aria-label="Download" onClick={() => void download(f)}>
                          <Download />
                        </Button>
                        {(isAdmin || f.uploaded_by === currentUserId) && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Remove file"
                            onClick={() =>
                              startTransition(async () => {
                                const r = await deleteAttachment(f.id);
                                if (!r.ok) toast.error(r.error);
                                await load();
                              })
                            }
                          >
                            <X />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Comments</h3>
                <ul className="space-y-3">
                  {comments.map((c) => {
                    const author = members.find((m) => m.id === c.author_id);
                    return (
                      <li key={c.id} className="flex gap-2.5">
                        <MemberAvatar name={author?.name ?? "A member"} avatarUrl={author?.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{nameOf(c.author_id)}</span> · {timeAgo(c.created_at)}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
                        </div>
                        {(isAdmin || c.author_id === currentUserId) && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Delete comment"
                            onClick={() =>
                              startTransition(async () => {
                                const r = await deleteComment(c.id);
                                if (!r.ok) toast.error(r.error);
                                await load();
                              })
                            }
                          >
                            <X />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <form
                  action={(form) =>
                    startTransition(async () => {
                      const body = String(form.get("body") ?? "");
                      const r = await addComment({ taskId: task.id, body });
                      if (!r.ok) return void toast.error(r.error);
                      await load();
                    })
                  }
                  className="space-y-2"
                >
                  <Textarea key={comments.length} name="body" rows={2} maxLength={5000} placeholder="Write a comment…" required />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={pending}>
                      Comment
                    </Button>
                  </div>
                </form>
              </section>

              {canDelete && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await deleteTask(task.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Task deleted");
                        onDeleted(task.id);
                      })
                    }
                  >
                    <Trash2 className="size-3.5" /> Delete task
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
