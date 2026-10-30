import type { TaskPriority } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const styles: Record<TaskPriority, string> = {
  urgent: "bg-rose-400/15 text-rose-300",
  high: "bg-amber-400/15 text-amber-300",
  medium: "bg-sky-400/15 text-sky-300",
  low: "bg-slate-400/15 text-slate-300",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", styles[priority])}>{priority}</span>
  );
}
