import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { OrganizationList, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { AppNav } from "@/components/app/app-nav";
import { isClerkConfigured, isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Workspace" };

// Every workspace page depends on the Clerk session and RLS-scoped data.
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured() || !isSupabaseConfigured()) return <SetupChecklist />;

  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/app" className="shrink-0">
            <Logo />
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/app"
            afterSelectOrganizationUrl="/app"
            organizationProfileUrl="/app/team"
            organizationProfileMode="navigation"
          />
          <AppNav />
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {orgId ? (
          children
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-12 text-center">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Pick an organization</h1>
              <p className="mt-2 text-muted-foreground">
                Every project and task belongs to an organization. Create one for your team, or accept an invitation.
              </p>
            </div>
            <OrganizationList hidePersonal afterCreateOrganizationUrl="/app" afterSelectOrganizationUrl="/app" />
          </div>
        )}
      </main>
    </div>
  );
}
