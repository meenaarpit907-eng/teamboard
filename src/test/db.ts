import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const MIGRATIONS_DIR = path.join(root, "supabase/migrations");

/** Migrations that need hosted-only extensions (pg_cron, pg_net, vault). */
const HOSTED_ONLY = ["_weekly_digest_cron.sql"];

export type Claims = {
  sub: string;
  org?: { id: string; rol: string } | null;
  role?: string;
};

/** Boots an in-memory Postgres with the Supabase shim, migrations and seed. */
export async function createTestDb() {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(root, "src/test/supabase-shim.sql"), "utf8"));
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !HOSTED_ONLY.some((s) => f.endsWith(s)))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  return db;
}

/** Builds a Clerk-style session token payload (session token v2 "o" claim). */
export function clerkClaims({ sub, org, role = "authenticated" }: Claims) {
  return {
    sub,
    role,
    ...(org ? { o: { id: org.id, rol: org.rol, slg: org.id.toLowerCase() } } : {}),
  };
}

/**
 * Runs `fn` as the `authenticated` role with the given claims, inside a
 * transaction that is always rolled back.
 */
export async function asUser<T>(
  db: PGlite,
  claims: Record<string, unknown> | null,
  fn: (q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
  role: "authenticated" | "anon" | "service_role" = "authenticated",
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify(claims) : ""]);
    await tx.exec(`set local role ${role}`);
    const q = async <R,>(sql: string, params: unknown[] = []) => (await tx.query<R>(sql, params)).rows;
    try {
      return await fn(q);
    } finally {
      await tx.rollback();
    }
  }) as Promise<T>;
}
