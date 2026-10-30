import { describe, expect, it } from "vitest";
import { isAdminRole, normalizeOrgRole } from "./roles";
import { applyTaskChange, attachmentPath, groupByStatus, isOverdue } from "./tasks";
import { projectSchema, taskCreateSchema } from "./validation";
import type { Task } from "./supabase/types";

const task = (over: Partial<Task>): Task => ({
  id: "t1",
  org_id: "org_1",
  project_id: "p1",
  title: "Task",
  description: null,
  status: "todo",
  priority: "medium",
  assignee_id: null,
  due_date: null,
  position: 1,
  created_by: "user_1",
  created_at: "2026-10-30T00:00:00Z",
  updated_at: "2026-10-30T00:00:00Z",
  completed_at: null,
  ...over,
});

describe("roles", () => {
  it("normalises Clerk role keys", () => {
    expect(normalizeOrgRole("org:admin")).toBe("admin");
    expect(normalizeOrgRole("admin")).toBe("admin");
    expect(normalizeOrgRole(undefined)).toBe("member");
    expect(isAdminRole("org:admin")).toBe(true);
    expect(isAdminRole("org:member")).toBe(false);
  });
});

describe("groupByStatus", () => {
  it("groups and sorts by priority then position", () => {
    const groups = groupByStatus([
      task({ id: "a", priority: "low", position: 1 }),
      task({ id: "b", priority: "urgent", position: 5 }),
      task({ id: "c", status: "done" }),
    ]);
    expect(groups.todo.map((t) => t.id)).toEqual(["b", "a"]);
    expect(groups.done.map((t) => t.id)).toEqual(["c"]);
    expect(groups.in_progress).toEqual([]);
  });
});

describe("applyTaskChange", () => {
  const base = [task({ id: "a" })];

  it("inserts, updates and deletes idempotently", () => {
    const inserted = applyTaskChange(base, { eventType: "INSERT", new: task({ id: "b" }), old: {} });
    expect(inserted.map((t) => t.id)).toEqual(["a", "b"]);
    expect(applyTaskChange(inserted, { eventType: "INSERT", new: task({ id: "b" }), old: {} })).toHaveLength(2);
    const updated = applyTaskChange(base, {
      eventType: "UPDATE",
      new: task({ id: "a", status: "done", updated_at: "2026-10-31T00:00:00Z" }),
      old: {},
    });
    expect(updated[0].status).toBe("done");
    expect(applyTaskChange(base, { eventType: "DELETE", new: {}, old: { id: "a" } })).toEqual([]);
  });

  it("ignores stale updates", () => {
    const fresh = [task({ id: "a", title: "new", updated_at: "2026-10-31T00:00:00Z" })];
    const result = applyTaskChange(fresh, {
      eventType: "UPDATE",
      new: task({ id: "a", title: "old", updated_at: "2026-10-30T00:00:00Z" }),
      old: {},
    });
    expect(result[0].title).toBe("new");
  });
});

describe("isOverdue", () => {
  it("is true only for open tasks past their due date", () => {
    expect(isOverdue({ status: "todo", due_date: "2026-10-01" }, "2026-10-30")).toBe(true);
    expect(isOverdue({ status: "done", due_date: "2026-10-01" }, "2026-10-30")).toBe(false);
    expect(isOverdue({ status: "todo", due_date: null }, "2026-10-30")).toBe(false);
  });
});

describe("attachmentPath", () => {
  it("prefixes with org and task and sanitises the name", () => {
    expect(attachmentPath("org_1", "t1", "../../My Report (final).pdf", "abc")).toBe(
      "org_1/t1/abc-My_Report_final_.pdf",
    );
  });
});

describe("validation", () => {
  it("trims and requires names", () => {
    expect(projectSchema.parse({ name: "  Site  " })).toEqual({ name: "Site", description: null, color: "violet" });
    expect(projectSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("accepts an empty assignee and due date from forms", () => {
    const parsed = taskCreateSchema.parse({
      projectId: "11111111-1111-4111-8111-111111111111",
      title: "Write tests",
      assigneeId: "",
      dueDate: "",
    });
    expect(parsed.assigneeId).toBeUndefined();
    expect(parsed.dueDate).toBeUndefined();
  });
});
