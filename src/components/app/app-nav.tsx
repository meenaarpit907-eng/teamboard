"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/app", label: "Projects", match: (p: string) => p === "/app" || p.startsWith("/app/projects") },
  { href: "/app/activity", label: "Activity", match: (p: string) => p.startsWith("/app/activity") },
  { href: "/app/team", label: "Team", match: (p: string) => p.startsWith("/app/team") },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm md:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
            l.match(pathname) && "bg-muted text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
