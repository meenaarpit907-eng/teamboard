import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  Database,
  FileLock2,
  GitBranch,
  Radio,
  ShieldCheck,
  TestTube2,
  Webhook,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ArchitectureDiagram } from "@/components/landing/architecture";
import { BoardPreview } from "@/components/landing/board-preview";
import { CodeBlock } from "@/components/landing/code-block";

// Marketing page: fully static, revalidated hourly (ISR) so copy changes ship
// without a rebuild of the dynamic workspace.
export const revalidate = 3600;

const REPO = "https://github.com/meenaarpit907-eng/teamboard";

const features = [
  {
    icon: Building2,
    title: "Clerk Organizations",
    text: "Sign-in, org switcher, invitations and admin/member roles come from Clerk. Switching orgs mints a new session token.",
  },
  {
    icon: ShieldCheck,
    title: "Tenancy enforced by Postgres",
    text: "Supabase trusts Clerk as a third-party auth provider. RLS policies read the org id and role straight from the verified JWT.",
  },
  {
    icon: Radio,
    title: "Realtime board",
    text: "Task changes stream over Supabase Realtime. Events pass the same SELECT policies, so no tenant ever sees another's updates.",
  },
  {
    icon: FileLock2,
    title: "Per-org file storage",
    text: "Attachments live in a private bucket under <org_id>/<task_id>/. Storage policies check the first path segment against the token.",
  },
  {
    icon: Webhook,
    title: "Webhook sync",
    text: "Clerk user, organization and membership events are verified with Svix and mirrored into Postgres for display and joins.",
  },
  {
    icon: CalendarClock,
    title: "Scheduled digests",
    text: "pg_cron calls an Edge Function every Monday that writes a weekly activity summary for each organization.",
  },
];

const policy = `create policy "Members read tasks"
  on public.tasks for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy "Admins create projects"
  on public.projects for insert to authenticated
  with check (
    (select private.is_org_admin(org_id))
    and created_by = (select private.clerk_user_id())
  );

-- org id comes from the verified Clerk token, never from the client
create function private.active_org_id() returns text as $$
  select coalesce(auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'org_id');
$$ language sql stable;`;

const claims = `{
  "sub": "user_2x…",          // Clerk user id
  "role": "authenticated",     // added by Clerk's Supabase integration
  "o": {
    "id": "org_2y…",           // active organization
    "rol": "admin",            // role in that organization
    "slg": "acme-studio"
  }
}`;

const rules = [
  ["Read anything in the org", "Every member", "Only the active org in the token"],
  ["Create / edit tasks", "Every member", "created_by is forced to the token's sub"],
  ["Delete a task", "Admin or task creator", ""],
  ["Create / archive projects", "Admins only", "Role read from the o.rol claim"],
  ["Comments & files", "Members, as themselves", "Delete: admin or author"],
  ["Org / member mirror tables", "Read-only", "Written only by the verified webhook"],
];

const tests = [
  {
    icon: Database,
    title: "pgTAP",
    text: "supabase/tests/database/rls.test.sql impersonates Clerk tokens for three users in two orgs and asserts every policy.",
  },
  {
    icon: TestTube2,
    title: "RLS in Vitest",
    text: "The same migrations run in-process on PGlite with a small Supabase shim, so isolation is tested in CI without Docker.",
  },
  {
    icon: Bell,
    title: "Unit tests",
    text: "Webhook signature checks (real Svix signing), the Clerk→Postgres sync plan, Realtime merge logic and the digest maths.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[720px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#architecture" className="hover:text-foreground">Architecture</a>
          <a href="#security" className="hover:text-foreground">Security</a>
          <a href="#testing" className="hover:text-foreground">Testing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href={REPO}>
              <GitBranch className="size-4" /> Source
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href="/app">Open workspace</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Open source reference app · Clerk + Supabase + Vercel
          </p>
          <h1 className="text-gradient mx-auto max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Team workspaces where Postgres enforces the tenant boundary
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            TeamBoard is a multi-tenant project and task board. Clerk handles identity and organizations, Supabase
            verifies Clerk&apos;s tokens and isolates every row with RLS, and Vercel serves it from the edge.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/app">
                Try the workspace <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#architecture">How it works</a>
            </Button>
          </div>
          <BoardPreview />
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Features" title="Everything a B2B SaaS needs, wired the right way" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border bg-card/60 p-6 transition-colors hover:border-primary/40">
                <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="architecture" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle
            eyebrow="Architecture"
            title="One token, three platforms"
            text="The Clerk session token is the only credential the browser and the server ever send to Supabase. Postgres verifies it against Clerk's JWKS and applies RLS to PostgREST, Realtime and Storage alike."
          />
          <ArchitectureDiagram />
        </section>

        <section id="security" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle
            eyebrow="Security model"
            title="Isolation that doesn't depend on app code"
            text="There is no `where org_id = …` in the application. Queries run as the signed-in user, and the database decides."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <CodeBlock title="supabase/migrations/*_rls.sql" code={policy} />
            <div className="space-y-6">
              <CodeBlock title="Clerk session token (decoded)" code={claims} />
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Action</th>
                      <th className="px-4 py-2.5 font-medium">Who</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map(([action, who, note]) => (
                      <tr key={action} className="border-t">
                        <td className="px-4 py-2.5">{action}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {who}
                          {note && <span className="block text-xs text-muted-foreground/70">{note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="testing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Testing" title="Policies are tested, not trusted" />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {tests.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border bg-card/60 p-6">
                <Icon className="size-5 text-primary" />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-emerald-400/10" />
            <h2 className="relative text-3xl font-semibold tracking-tight">Create an organization and invite your team</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
              Sign up, create an org from the switcher, and open the board in two browsers to watch Realtime keep them in
              sync.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/app">Open workspace</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={REPO}>Read the code</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo className="text-foreground" />
          <p>
            Built by{" "}
            <a href="https://arpitm.me" className="text-foreground hover:text-primary">
              Arpit Meena
            </a>{" "}
            · Next.js · Clerk · Supabase · Vercel
          </p>
          <a href={REPO} className="hover:text-foreground">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-muted-foreground">{text}</p>}
    </div>
  );
}
