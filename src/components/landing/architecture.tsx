import { ArrowDown, ArrowRight } from "lucide-react";

type NodeProps = { title: string; items: string[]; accent: string };

function Node({ title, items, accent }: NodeProps) {
  return (
    <div className="relative rounded-xl border bg-card p-5">
      <div className={`absolute inset-x-0 top-0 h-0.5 rounded-t-xl ${accent}`} />
      <p className="font-medium">{title}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-2 text-center text-[11px] leading-tight text-muted-foreground lg:py-0">
      <ArrowRight className="hidden size-5 text-primary lg:block" />
      <ArrowDown className="size-5 text-primary lg:hidden" />
      <span className="max-w-[9rem]">{label}</span>
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <div className="mt-12 space-y-6">
      <div className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Node
          title="Clerk"
          accent="bg-violet-400"
          items={["Users, sessions, MFA", "Organizations, roles, invites", "Session token with o.id / o.rol", "Webhooks via Svix"]}
        />
        <Arrow label="session token (JWT)" />
        <Node
          title="Vercel · Next.js"
          accent="bg-sky-400"
          items={[
            "Middleware protects /app",
            "Server Components + Server Actions",
            "/api/webhooks/clerk (Svix-verified)",
            "ISR landing, Analytics, Speed Insights",
          ]}
        />
        <Arrow label="Bearer <Clerk token>" />
        <Node
          title="Supabase"
          accent="bg-emerald-400"
          items={[
            "Third-party auth: Clerk JWKS",
            "Postgres RLS on every table",
            "Realtime postgres_changes",
            "Private Storage bucket per org path",
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Flow
          step="1"
          title="Request path"
          text="Browser → Next.js server action → supabase-js with accessToken: getToken() → PostgREST → RLS checks sub, o.id, o.rol."
        />
        <Flow
          step="2"
          title="Sync path"
          text="Clerk user/org/membership event → Svix signature check → idempotent upserts into organizations, profiles, memberships."
        />
        <Flow
          step="3"
          title="Scheduled path"
          text="pg_cron (Mon 03:00 UTC) → pg_net → weekly-digest Edge Function → per-org summary rows in digests."
        />
      </div>
    </div>
  );
}

function Flow({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-xs text-primary">{step}</span>
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
