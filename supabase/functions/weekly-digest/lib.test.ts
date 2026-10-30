import { describe, expect, it } from "vitest";
import { buildDigests, computeStats, safeEqual, summarize, weeklyWindow } from "./lib";

describe("weeklyWindow", () => {
  it("ends at the latest Monday 00:00 UTC and spans 7 days", () => {
    const { start, end } = weeklyWindow(new Date("2026-11-04T10:00:00Z")); // Wednesday
    expect(end.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("on a Monday, covers the previous week", () => {
    const { start, end } = weeklyWindow(new Date("2026-11-02T03:00:00Z"));
    expect(end.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

const at = "2026-10-28T10:00:00Z";
const activity = [
  { org_id: "org_a", actor_id: "user_1", entity: "tasks", action: "created", created_at: at },
  { org_id: "org_a", actor_id: "user_1", entity: "tasks", action: "completed", created_at: at },
  { org_id: "org_a", actor_id: "user_2", entity: "task_comments", action: "commented", created_at: at },
  { org_id: "org_a", actor_id: "user_2", entity: "task_attachments", action: "attached_file", created_at: at },
  { org_id: "org_b", actor_id: "user_3", entity: "tasks", action: "created", created_at: at },
];
const open = [
  { org_id: "org_a", due_date: "2026-10-01", status: "todo" as const },
  { org_id: "org_a", due_date: null, status: "in_progress" as const },
  { org_id: "org_c", due_date: "2026-12-01", status: "todo" as const },
];

describe("computeStats", () => {
  it("counts events, members and overdue tasks", () => {
    const stats = computeStats(activity.filter((a) => a.org_id === "org_a"), open.filter((t) => t.org_id === "org_a"), "2026-11-02");
    expect(stats).toEqual({
      tasksCreated: 1,
      tasksCompleted: 1,
      comments: 1,
      filesAttached: 1,
      activeMembers: 2,
      openTasks: 2,
      overdueTasks: 1,
      topContributors: [
        { userId: "user_1", events: 2 },
        { userId: "user_2", events: 2 },
      ],
    });
  });
});

describe("summarize", () => {
  it("describes an active week", () => {
    const stats = computeStats(activity.filter((a) => a.org_id === "org_a"), open.filter((t) => t.org_id === "org_a"), "2026-11-02");
    expect(summarize(stats)).toBe(
      "1 task created, 1 completed, 1 comment, 1 file attached by 2 active members. 2 tasks still open, 1 overdue.",
    );
  });

  it("describes a quiet week", () => {
    const stats = computeStats([], [{ org_id: "x", due_date: null, status: "todo" }], "2026-11-02");
    expect(summarize(stats)).toBe("A quiet week: no activity, 1 open task waiting.");
  });
});

describe("buildDigests", () => {
  it("builds one digest per org that has activity or open tasks", () => {
    const digests = buildDigests(activity, open, weeklyWindow(new Date("2026-11-02T03:00:00Z")));
    expect(digests.map((d) => d.org_id)).toEqual(["org_a", "org_b", "org_c"]);
    expect(digests[0].period_start).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("safeEqual", () => {
  it("compares secrets", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
