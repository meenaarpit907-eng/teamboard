"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser Supabase client authenticated with the Clerk session token. Used for
 * Realtime subscriptions and direct-to-Storage uploads; both are checked by RLS
 * (Realtime only delivers rows the token may SELECT).
 */
export function useSupabaseBrowser() {
  const { session } = useSession();
  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !session) return null;
    return createClient<Database>(url, key, {
      accessToken: async () => (await session.getToken()) ?? null,
    });
  }, [session]);
}
