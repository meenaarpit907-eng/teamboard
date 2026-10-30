import { Webhook } from "svix";
import { normalizeOrgRole } from "@/lib/roles";

/**
 * Clerk -> Postgres sync. Clerk sends webhooks through Svix; we verify the
 * signature, then translate each event into idempotent upserts/deletes on the
 * mirror tables (organizations, profiles, memberships). Planning is pure so it
 * can be unit-tested without a database.
 */

export const SYNCED_EVENTS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "organizationMembership.created",
  "organizationMembership.updated",
  "organizationMembership.deleted",
] as const;

export type ClerkEvent = { type: string; data: Record<string, unknown> };

type Row = Record<string, string | null>;
export type SyncOp =
  | { kind: "upsert"; table: "organizations" | "profiles" | "memberships"; rows: Row[]; onConflict: string }
  | { kind: "delete"; table: "organizations" | "profiles" | "memberships"; match: Record<string, string> };

export class WebhookVerificationError extends Error {}

/** Verifies the svix-id / svix-timestamp / svix-signature headers. */
export function verifyClerkWebhook(payload: string, headers: Headers, secret: string): ClerkEvent {
  const svixHeaders = {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  };
  if (!svixHeaders["svix-id"] || !svixHeaders["svix-timestamp"] || !svixHeaders["svix-signature"]) {
    throw new WebhookVerificationError("missing svix headers");
  }
  try {
    return new Webhook(secret).verify(payload, svixHeaders) as ClerkEvent;
  } catch {
    throw new WebhookVerificationError("invalid signature");
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function fullName(first: unknown, last: unknown): string | null {
  const name = [str(first), str(last)].filter(Boolean).join(" ").trim();
  return name || null;
}

function primaryEmail(data: Record<string, unknown>): string | null {
  const emails = Array.isArray(data.email_addresses) ? (data.email_addresses as Record<string, unknown>[]) : [];
  const primary = emails.find((e) => e.id === data.primary_email_address_id) ?? emails[0];
  return str(primary?.email_address);
}

function orgRow(org: Record<string, unknown>): Row {
  return { id: str(org.id), name: str(org.name) ?? "Untitled organization", slug: str(org.slug), image_url: str(org.image_url) };
}

export function planClerkSync(event: ClerkEvent): SyncOp[] {
  const d = event.data ?? {};
  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const id = str(d.id);
      if (!id) return [];
      return [
        {
          kind: "upsert",
          table: "profiles",
          onConflict: "id",
          rows: [{ id, email: primaryEmail(d), full_name: fullName(d.first_name, d.last_name), avatar_url: str(d.image_url) }],
        },
      ];
    }
    case "user.deleted": {
      const id = str(d.id);
      return id ? [{ kind: "delete", table: "profiles", match: { id } }] : [];
    }
    case "organization.created":
    case "organization.updated": {
      const row = orgRow(d);
      return row.id ? [{ kind: "upsert", table: "organizations", onConflict: "id", rows: [row] }] : [];
    }
    case "organization.deleted": {
      const id = str(d.id);
      return id ? [{ kind: "delete", table: "organizations", match: { id } }] : [];
    }
    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const org = (d.organization ?? {}) as Record<string, unknown>;
      const user = (d.public_user_data ?? {}) as Record<string, unknown>;
      const orgId = str(org.id);
      const userId = str(user.user_id);
      if (!orgId || !userId) return [];
      // Membership events can arrive before user/org events; upsert both
      // parents first so the foreign keys hold regardless of delivery order.
      return [
        { kind: "upsert", table: "organizations", onConflict: "id", rows: [orgRow(org)] },
        {
          kind: "upsert",
          table: "profiles",
          onConflict: "id",
          rows: [
            {
              id: userId,
              email: str(user.identifier),
              full_name: fullName(user.first_name, user.last_name),
              avatar_url: str(user.image_url),
            },
          ],
        },
        {
          kind: "upsert",
          table: "memberships",
          onConflict: "org_id,user_id",
          rows: [{ org_id: orgId, user_id: userId, role: normalizeOrgRole(str(d.role)) }],
        },
      ];
    }
    case "organizationMembership.deleted": {
      const orgId = str((d.organization as Record<string, unknown> | undefined)?.id);
      const userId = str((d.public_user_data as Record<string, unknown> | undefined)?.user_id);
      return orgId && userId ? [{ kind: "delete", table: "memberships", match: { org_id: orgId, user_id: userId } }] : [];
    }
    default:
      return [];
  }
}
