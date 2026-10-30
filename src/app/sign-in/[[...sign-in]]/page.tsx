import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/app/auth-shell";
import { isClerkConfigured } from "@/lib/env";
import { SetupChecklist } from "@/components/app/setup-checklist";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  if (!isClerkConfigured()) return <SetupChecklist />;
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
