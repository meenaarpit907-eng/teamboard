import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <rect x="3" y="4" width="5" height="16" rx="1.5" />
          <rect x="10" y="4" width="5" height="10" rx="1.5" />
          <rect x="17" y="4" width="4" height="6" rx="1.5" />
        </svg>
      </span>
      <span>TeamBoard</span>
    </span>
  );
}
