import type { ActivityLog } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return "just now";
}

export function ActivityList({
  items,
  names,
  compact,
}: {
  items: ActivityLog[];
  names: Record<string, string>;
  compact?: boolean;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className={cn("space-y-3", !compact && "space-y-4")}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="text-foreground/90">
              <span className="font-medium">{item.actor_id ? names[item.actor_id] ?? "A member" : "System"}</span>{" "}
              <span className="break-words text-muted-foreground">{item.summary}</span>
            </p>
            <time className="text-xs text-muted-foreground/70" dateTime={item.created_at}>
              {timeAgo(item.created_at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
