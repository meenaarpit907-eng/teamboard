import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/app/auth-shell";
import { isClerkConfigured } from "@/lib/env";
import { SetupChecklist } from "@/components/app/setup-checklist";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  if (!isClerkConfigured()) return <SetupChecklist />;
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  );
}
