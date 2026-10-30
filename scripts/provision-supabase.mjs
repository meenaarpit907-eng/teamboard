#!/usr/bin/env node
/**
 * Provisions the hosted Supabase project for TeamBoard through the
 * Management API. Idempotent: safe to re-run.
 *
 *   SUPABASE_ACCESS_TOKEN   personal access token with org access (required)
 *   SUPABASE_PROJECT_REF    use an existing project, or…
 *   SUPABASE_ORG_ID         …create one in this org (with SUPABASE_DB_PASSWORD)
 *   SUPABASE_REGION         default ap-south-1
 *   CLERK_DOMAIN            e.g. happy-cat-12.clerk.accounts.dev -> registers Clerk as third-party auth
 *
 * Steps: create/wait for project -> apply supabase/migrations (recorded in
 * supabase_migrations.schema_migrations so `supabase db push` stays in sync)
 * -> Clerk third-party auth -> Vault secrets + function secret for the cron
 * -> deploy the weekly-digest Edge Function -> print URL + publishable key.
 * Secrets are never printed.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required");

async function api(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const sql = (ref, query) => api("POST", `/projects/${ref}/database/query`, { query });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureProject() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const org = process.env.SUPABASE_ORG_ID;
  const dbPass = process.env.SUPABASE_DB_PASSWORD;
  if (!org || !dbPass) throw new Error("Set SUPABASE_PROJECT_REF, or SUPABASE_ORG_ID + SUPABASE_DB_PASSWORD");
  const existing = (await api("GET", "/projects")).find((p) => p.name === "teamboard" && p.organization_id === org);
  if (existing) return existing.id;
  const created = await api("POST", "/projects", {
    name: "teamboard",
    organization_id: org,
    region: process.env.SUPABASE_REGION ?? "ap-south-1",
    db_pass: dbPass,
  });
  console.log(`created project ${created.id}`);
  return created.id;
}

async function waitHealthy(ref) {
  for (let i = 0; i < 90; i++) {
    const p = await api("GET", `/projects/${ref}`);
    if (p.status === "ACTIVE_HEALTHY") return;
    process.stdout.write(`waiting for project (${p.status})…\r`);
    await sleep(10_000);
  }
  throw new Error("project did not become healthy in 15 minutes");
}

async function applyMigrations(ref) {
  await sql(
    ref,
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`,
  );
  const applied = new Set((await sql(ref, "select version from supabase_migrations.schema_migrations")).map((r) => r.version));
  const dir = path.join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    const body = readFileSync(path.join(dir, file), "utf8");
    await sql(
      ref,
      `begin;\n${body}\n;insert into supabase_migrations.schema_migrations (version, name) values (${lit(version)}, ${lit(rest.join("_"))});\ncommit;`,
    );
    console.log(`applied ${file}`);
  }
}

async function clerkThirdPartyAuth(ref) {
  const domain = process.env.CLERK_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) return console.log("CLERK_DOMAIN not set: skipping Clerk third-party auth");
  const issuer = `https://${domain}`;
  const current = await api("GET", `/projects/${ref}/config/auth/third-party-auth`);
  if (current.some((p) => p.oidc_issuer_url === issuer)) return console.log("Clerk third-party auth already set");
  await api("POST", `/projects/${ref}/config/auth/third-party-auth`, { oidc_issuer_url: issuer });
  console.log(`registered Clerk (${issuer}) as third-party auth`);
}

async function cronSecrets(ref) {
  const rows = await sql(ref, "select name from vault.secrets where name in ('project_url','digest_cron_secret')");
  const have = new Set(rows.map((r) => r.name));
  if (!have.has("project_url")) await sql(ref, `select vault.create_secret(${lit(`https://${ref}.supabase.co`)}, 'project_url')`);
  if (!have.has("digest_cron_secret")) {
    const secret = randomBytes(32).toString("hex");
    await sql(ref, `select vault.create_secret(${lit(secret)}, 'digest_cron_secret')`);
    await api("POST", `/projects/${ref}/secrets`, [{ name: "DIGEST_CRON_SECRET", value: secret }]);
    console.log("created digest cron secret (Vault + function secret)");
  }
}

function deployFunction(ref) {
  execFileSync("npx", ["supabase", "functions", "deploy", "weekly-digest", "--project-ref", ref, "--use-api"], {
    stdio: "inherit",
    env: process.env,
  });
}

const ref = await ensureProject();
await waitHealthy(ref);
await applyMigrations(ref);
await clerkThirdPartyAuth(ref);
await cronSecrets(ref);
deployFunction(ref);
const keys = await api("GET", `/projects/${ref}/api-keys?reveal=false`);
const publishable = keys.find((k) => k.type === "publishable")?.api_key;
console.log(`\nNEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co`);
console.log(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable ?? "(create one in Project Settings > API keys)"}`);
console.log("SUPABASE_SECRET_KEY: copy from Project Settings > API keys (not printed)");
