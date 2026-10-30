import Link from "next/link";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { Logo } from "@/components/logo";
import { getSetupStatus } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REPO = "https://github.com/meenaarpit907-eng/teamboard";

/** Shown instead of the workspace while Clerk or Supabase keys are missing. */
export function SetupChecklist() {
  const status = getSetupStatus();
  const items = [
    {
      done: status.clerk,
      title: "Clerk is not configured",
      doneTitle: "Clerk keys are set",
      env: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
      text: "Create a Clerk application, enable Organizations and activate the Supabase integration.",
    },
    {
      done: status.supabase,
      title: "Supabase is not configured",
      doneTitle: "Supabase URL and publishable key are set",
      env: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      text: "Apply the migrations and add Clerk under Authentication → Third-Party Auth.",
    },
    {
      done: status.webhook && status.serviceKey,
      title: "Clerk → Supabase sync is not configured",
      doneTitle: "Webhook sync is configured",
      env: ["CLERK_WEBHOOK_SIGNING_SECRET", "SUPABASE_SECRET_KEY"],
      text: "Point a Clerk webhook at /api/webhooks/clerk for user, organization and membership events.",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-4 py-16">
      <Link href="/">
        <Logo />
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>This deployment isn&apos;t fully configured yet</CardTitle>
          <CardDescription>
            The workspace needs these environment variables. Nothing secret is shown here, only whether each one is
            present.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.map((item) => (
            <div key={item.title} className="flex gap-3">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
              ) : (
                <CircleDashed className="mt-0.5 size-5 shrink-0 text-amber-400" />
              )}
              <div className="space-y-1.5">
                <p className="font-medium">{item.done ? item.doneTitle : item.title}</p>
                {!item.done && <p className="text-sm text-muted-foreground">{item.text}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {item.env.map((name) => (
                    <code key={name} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {name}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Full setup steps are in the{" "}
            <a href={`${REPO}#setup`} className="text-primary underline-offset-4 hover:underline">
              README
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
