import { z } from "zod";

const trimmed = (max: number) => z.string().trim().min(1, "Required").max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const projectSchema = z.object({
  name: trimmed(120),
  description: optionalText(2000),
  color: z.enum(["violet", "emerald", "sky", "amber", "rose", "slate"]).default("violet"),
});

export const taskCreateSchema = z.object({
  projectId: z.uuid(),
  title: trimmed(200),
  description: optionalText(10000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  assigneeId: z
    .string()
    .regex(/^user_[A-Za-z0-9]+$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const taskUpdateSchema = z.object({
  id: z.uuid(),
  title: trimmed(200).optional(),
  description: z
    .string()
    .trim()
    .max(10000)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeId: z.string().regex(/^user_[A-Za-z0-9]+$/).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const commentSchema = z.object({
  taskId: z.uuid(),
  body: trimmed(5000),
});

export const attachmentSchema = z.object({
  taskId: z.uuid(),
  storagePath: z.string().min(1).max(512),
  fileName: trimmed(255),
  contentType: z.string().max(255).nullable().optional(),
  sizeBytes: z.number().int().nonnegative().max(10 * 1024 * 1024),
});

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
