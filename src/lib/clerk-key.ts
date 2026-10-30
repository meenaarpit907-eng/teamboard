/**
 * Clerk publishable keys encode the instance's Frontend API host:
 * pk_test_<base64("happy-cat-12.clerk.accounts.dev$")>. The host is needed for
 * the Content-Security-Policy (script-src / connect-src), so it is decoded here
 * instead of being configured twice. Pure and dependency-free so next.config.ts
 * can import it.
 */
export function clerkFrontendApiHost(publishableKey: string | undefined | null): string | null {
  const key = publishableKey?.trim();
  const match = key?.match(/^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/);
  if (!match) {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(match[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
  if (!decoded.endsWith("$")) {
    return null;
  }
  const host = decoded.slice(0, -1);
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host) ? host : null;
}
