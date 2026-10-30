import { NextResponse } from "next/server";
import { planClerkSync, verifyClerkWebhook, WebhookVerificationError, type SyncOp } from "@/lib/clerk-sync";
import { createServiceSupabase, type TypedClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function apply(supabase: TypedClient, op: SyncOp) {
  if (op.kind === "upsert") {
    // Rows are built by planClerkSync for exactly these tables.
    const { error } = await supabase.from(op.table).upsert(op.rows as never, { onConflict: op.onConflict });
    if (error) throw error;
    return;
  }
  let query = supabase.from(op.table).delete();
  for (const [column, value] of Object.entries(op.match)) query = query.eq(column, value);
  const { error } = await query;
  if (error) throw error;
}

/**
 * Clerk webhook endpoint (users, organizations, memberships).
 * Configure in Clerk Dashboard > Webhooks with this URL and copy the signing
 * secret into CLERK_WEBHOOK_SIGNING_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim();
  const supabase = createServiceSupabase();
  if (!secret || !supabase) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const payload = await request.text();
  let event;
  try {
    event = verifyClerkWebhook(payload, request.headers, secret);
  } catch (error) {
    const message = error instanceof WebhookVerificationError ? error.message : "invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const ops = planClerkSync(event);
  try {
    for (const op of ops) await apply(supabase, op);
  } catch (error) {
    console.error("[clerk-webhook] sync failed", event.type, error);
    // 500 makes Svix retry with backoff.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, type: event.type, operations: ops.length });
}
