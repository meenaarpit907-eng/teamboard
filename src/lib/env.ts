/**
 * Environment helpers. The app degrades gracefully: without Clerk keys it
 * renders the landing page plus a setup checklist instead of crashing, and
 * without Supabase keys the workspace explains what is missing.
 */
export function isClerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const sk = process.env.CLERK_SECRET_KEY?.trim() ?? "";
  return /^pk_(test|live)_/.test(pk) && /^sk_(test|live)_/.test(sk);
}

/** Client-safe variant: only the publishable key is visible in the browser. */
export function isClerkPublishableKeySet(): boolean {
  return /^pk_(test|live)_/.test(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "");
}

export function getSupabasePublicConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export type SetupStatus = {
  clerk: boolean;
  supabase: boolean;
  webhook: boolean;
  serviceKey: boolean;
};

export function getSetupStatus(): SetupStatus {
  return {
    clerk: isClerkConfigured(),
    supabase: isSupabaseConfigured(),
    webhook: Boolean(process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim()),
    serviceKey: Boolean(process.env.SUPABASE_SECRET_KEY?.trim()),
  };
}
