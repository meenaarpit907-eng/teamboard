import Link from "next/link";
import { Logo } from "@/components/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <Link href="/" className="relative">
        <Logo />
      </Link>
      <div className="relative">{children}</div>
    </main>
  );
}
