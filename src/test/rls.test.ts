import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, clerkClaims, createTestDb } from "./db";

const ACME = "org_seedAcme";
const GLOBEX = "org_seedGlobex";
const alice = clerkClaims({ sub: "user_seedAlice", org: { id: ACME, rol: "admin" } });
const bob = clerkClaims({ sub: "user_seedBob", org: { id: ACME, rol: "member" } });
const carol = clerkClaims({ sub: "user_seedCarol", org: { id: GLOBEX, rol: "admin" } });
const aliceNoOrg = clerkClaims({ sub: "user_seedAlice" });
const ACME_PROJECT = "11111111-1111-4111-8111-111111111111";
const GLOBEX_PROJECT = "33333333-3333-4333-8333-333333333333";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("tenant isolation", () => {
  it("anon sees nothing", async () => {
    await expect(asUser(db, null, (q) => q("select * from public.tasks"), "anon")).rejects.toThrow(/permission denied/);
  });

  it("members only see their active organization's tasks", async () => {
    const acme = await asUser(db, bob, (q) => q<{ org_id: string }>("select org_id from public.tasks"));
    expect(acme.length).toBe(4);
    expect(new Set(acme.map((r) => r.org_id))).toEqual(new Set([ACME]));

    const globex = await asUser(db, carol, (q) => q<{ org_id: string }>("select org_id from public.tasks"));
    expect(globex.map((r) => r.org_id)).toEqual([GLOBEX]);
  });

  it("a signed-in user without an active org sees no tenant data", async () => {
    const rows = await asUser(db, aliceNoOrg, (q) => q("select id from public.projects"));
    expect(rows).toEqual([]);
  });

  it("supports Clerk v1-style org_id/org_role claims", async () => {
    const v1 = { sub: "user_seedBob", role: "authenticated", org_id: ACME, org_role: "org:member" };
    const rows = await asUser(db, v1, (q) => q("select id from public.projects"));
    expect(rows.length).toBe(2);
  });

  it("a forged token without role=authenticated is rejected by policies", async () => {
    const rows = await asUser(db, { ...bob, role: "anon" }, (q) => q("select id from public.tasks"));
    expect(rows).toEqual([]);
  });

  it("cannot insert a task into another org, even by passing org_id", async () => {
    await expect(
      asUser(db, bob, (q) =>
        q("insert into public.tasks (org_id, project_id, title) values ($1, $2, 'sneaky')", [GLOBEX, GLOBEX_PROJECT]),
      ),
    ).rejects.toThrow(/row-level security|foreign key/);
  });

  it("cannot attach a task to a project of another org", async () => {
    await expect(
      asUser(db, bob, (q) => q("insert into public.tasks (project_id, title) values ($1, 'cross')", [GLOBEX_PROJECT])),
    ).rejects.toThrow(/foreign key/);
  });

  it("cannot move a row to another org", async () => {
    await expect(
      asUser(db, alice, (q) => q("update public.projects set org_id = $1 where id = $2", [GLOBEX, ACME_PROJECT])),
    ).rejects.toThrow(/immutable|row-level security/);
  });

  it("updates to other orgs' rows silently affect nothing", async () => {
    const rows = await asUser(db, carol, (q) =>
      q("update public.tasks set title = 'pwned' where org_id = $1 returning id", [ACME]),
    );
    expect(rows).toEqual([]);
  });

  it("profiles are visible only for people in the active org", async () => {
    const rows = await asUser(db, bob, (q) => q<{ id: string }>("select id from public.profiles order by id"));
    expect(rows.map((r) => r.id)).toEqual(["user_seedAlice", "user_seedBob"]);
  });
});

describe("role-based writes", () => {
  it("members create tasks with org_id and created_by filled from the token", async () => {
    const [row] = await asUser(db, bob, (q) =>
      q<{ org_id: string; created_by: string }>(
        "insert into public.tasks (project_id, title) values ($1, 'From Bob') returning org_id, created_by",
        [ACME_PROJECT],
      ),
    );
    expect(row).toEqual({ org_id: ACME, created_by: "user_seedBob" });
  });

  it("members cannot impersonate another creator", async () => {
    await expect(
      asUser(db, bob, (q) =>
        q("insert into public.tasks (project_id, title, created_by) values ($1, 'x', 'user_seedAlice')", [ACME_PROJECT]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("only admins can create projects", async () => {
    await expect(
      asUser(db, bob, (q) => q("insert into public.projects (name) values ('Member project')")),
    ).rejects.toThrow(/row-level security/);
    const rows = await asUser(db, alice, (q) =>
      q<{ org_id: string }>("insert into public.projects (name) values ('Admin project') returning org_id"),
    );
    expect(rows[0].org_id).toBe(ACME);
  });

  it("members can delete only their own tasks; admins can delete any", async () => {
    const bobDeletesAlices = await asUser(db, bob, (q) =>
      q("delete from public.tasks where id = 'aaaaaaa1-0000-4000-8000-000000000001' returning id"),
    );
    expect(bobDeletesAlices).toEqual([]);
    const bobDeletesOwn = await asUser(db, bob, (q) =>
      q("delete from public.tasks where id = 'aaaaaaa1-0000-4000-8000-000000000003' returning id"),
    );
    expect(bobDeletesOwn.length).toBe(1);
    const aliceDeletes = await asUser(db, alice, (q) =>
      q("delete from public.tasks where id = 'aaaaaaa1-0000-4000-8000-000000000002' returning id"),
    );
    expect(aliceDeletes.length).toBe(1);
  });

  it("assignees must be members of the same org", async () => {
    await expect(
      asUser(db, alice, (q) =>
        q("update public.tasks set assignee_id = 'user_seedCarol' where id = 'aaaaaaa1-0000-4000-8000-000000000003'"),
      ),
    ).rejects.toThrow(/not a member/);
  });

  it("webhook-synced tables are read-only for users", async () => {
    await expect(
      asUser(db, alice, (q) => q("insert into public.memberships (org_id, user_id, role) values ($1, 'user_seedCarol', 'admin')", [ACME])),
    ).rejects.toThrow(/permission denied/);
  });

  it("comments are written as the caller", async () => {
    await expect(
      asUser(db, bob, (q) =>
        q("insert into public.task_comments (task_id, body, author_id) values ('aaaaaaa1-0000-4000-8000-000000000002', 'hi', 'user_seedAlice')"),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("activity log", () => {
  it("is written by triggers and readable only inside the org", async () => {
    const rows = await asUser(db, bob, async (q) => {
      await q("update public.tasks set status = 'done' where id = 'aaaaaaa1-0000-4000-8000-000000000002'");
      return q<{ summary: string; actor_id: string; org_id: string }>(
        "select summary, actor_id, org_id from public.activity_log where actor_id is not null",
      );
    });
    expect(rows).toEqual([{ summary: 'moved "Hero section copy" to done', actor_id: "user_seedBob", org_id: ACME }]);
  });

  it("cannot be written directly", async () => {
    await expect(
      asUser(db, alice, (q) => q("insert into public.activity_log (org_id, entity, action, summary) values ($1, 'x', 'y', 'z')", [ACME])),
    ).rejects.toThrow(/permission denied/);
  });

  it("sets completed_at when a task is done", async () => {
    const [row] = await asUser(db, bob, (q) =>
      q<{ completed_at: string | null }>(
        "update public.tasks set status = 'done' where id = 'aaaaaaa1-0000-4000-8000-000000000003' returning completed_at",
      ),
    );
    expect(row.completed_at).not.toBeNull();
  });
});
