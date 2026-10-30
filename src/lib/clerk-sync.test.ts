import { describe, expect, it } from "vitest";
import { Webhook } from "svix";
import { planClerkSync, verifyClerkWebhook, WebhookVerificationError } from "./clerk-sync";

// Test-only signing secret (svix format: whsec_ + base64). Not a real credential.
const SECRET = "whsec_" + Buffer.from("teamboard-test-secret-0123456789").toString("base64");

function signed(payload: string, secret = SECRET) {
  const id = "msg_test";
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, payload);
  return new Headers({
    "svix-id": id,
    "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "svix-signature": signature,
  });
}

describe("verifyClerkWebhook", () => {
  const payload = JSON.stringify({ type: "user.created", data: { id: "user_1" } });

  it("accepts a correctly signed payload", () => {
    expect(verifyClerkWebhook(payload, signed(payload), SECRET).type).toBe("user.created");
  });

  it("rejects a tampered payload", () => {
    const headers = signed(payload);
    expect(() => verifyClerkWebhook(payload.replace("user_1", "user_2"), headers, SECRET)).toThrow(
      WebhookVerificationError,
    );
  });

  it("rejects a payload signed with another secret", () => {
    const other = "whsec_" + Buffer.from("another-secret-another-secret-00").toString("base64");
    expect(() => verifyClerkWebhook(payload, signed(payload, other), SECRET)).toThrow(WebhookVerificationError);
  });

  it("rejects missing headers", () => {
    expect(() => verifyClerkWebhook(payload, new Headers(), SECRET)).toThrow(/missing svix headers/);
  });
});

describe("planClerkSync", () => {
  it("upserts a user's profile with the primary email", () => {
    const ops = planClerkSync({
      type: "user.created",
      data: {
        id: "user_1",
        first_name: "Ada",
        last_name: "Lovelace",
        image_url: "https://img.clerk.com/x",
        primary_email_address_id: "idn_2",
        email_addresses: [
          { id: "idn_1", email_address: "old@example.com" },
          { id: "idn_2", email_address: "ada@example.com" },
        ],
      },
    });
    expect(ops).toEqual([
      {
        kind: "upsert",
        table: "profiles",
        onConflict: "id",
        rows: [{ id: "user_1", email: "ada@example.com", full_name: "Ada Lovelace", avatar_url: "https://img.clerk.com/x" }],
      },
    ]);
  });

  it("deletes users and organizations", () => {
    expect(planClerkSync({ type: "user.deleted", data: { id: "user_1", deleted: true } })).toEqual([
      { kind: "delete", table: "profiles", match: { id: "user_1" } },
    ]);
    expect(planClerkSync({ type: "organization.deleted", data: { id: "org_1" } })).toEqual([
      { kind: "delete", table: "organizations", match: { id: "org_1" } },
    ]);
  });

  it("upserts parents before a membership and normalises the role", () => {
    const ops = planClerkSync({
      type: "organizationMembership.created",
      data: {
        role: "org:admin",
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        public_user_data: { user_id: "user_1", identifier: "ada@example.com", first_name: "Ada" },
      },
    });
    expect(ops.map((o) => o.table)).toEqual(["organizations", "profiles", "memberships"]);
    expect(ops[2]).toMatchObject({ rows: [{ org_id: "org_1", user_id: "user_1", role: "admin" }] });
  });

  it("deletes a membership", () => {
    expect(
      planClerkSync({
        type: "organizationMembership.deleted",
        data: { organization: { id: "org_1" }, public_user_data: { user_id: "user_1" } },
      }),
    ).toEqual([{ kind: "delete", table: "memberships", match: { org_id: "org_1", user_id: "user_1" } }]);
  });

  it("ignores unrelated or malformed events", () => {
    expect(planClerkSync({ type: "session.created", data: {} })).toEqual([]);
    expect(planClerkSync({ type: "user.created", data: {} })).toEqual([]);
  });
});
