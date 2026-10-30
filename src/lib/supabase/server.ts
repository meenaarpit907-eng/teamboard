import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export type TypedClient = SupabaseClient<Database>;

/**
 * Supabase client that acts as the signed-in Clerk user. Every query carries
 * the Clerk session token, Supabase verifies it against Clerk's JWKS
 * (third-party auth), and Postgres RLS decides what the user may see or do.
 * There is deliberately no app-level `where org_id = ...` anywhere: the
 * database enforces tenancy.
 */
export async function createUserSupabase(): Promise<TypedClient | null> {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  const { getToken } = await auth();
  return createClient<Database>(config.url, config.key, {
    accessToken: async () => (await getToken()) ?? null,
  });
}

/**
 * Service-role client for trusted server code only (the Clerk webhook).
 * Bypasses RLS, so it must never be reachable from user input without
 * verification. SUPABASE_SECRET_KEY is a server-only env var.
 */
export function createServiceSupabase(): TypedClient | null {
  const config = getSupabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !secret) return null;
  return createClient<Database>(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
