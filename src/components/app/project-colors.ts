import type { ProjectColor } from "@/lib/supabase/types";

export const PROJECT_COLORS: Record<ProjectColor, { dot: string; bar: string; label: string }> = {
  violet: { dot: "bg-violet-400", bar: "bg-violet-400", label: "Violet" },
  emerald: { dot: "bg-emerald-400", bar: "bg-emerald-400", label: "Emerald" },
  sky: { dot: "bg-sky-400", bar: "bg-sky-400", label: "Sky" },
  amber: { dot: "bg-amber-400", bar: "bg-amber-400", label: "Amber" },
  rose: { dot: "bg-rose-400", bar: "bg-rose-400", label: "Rose" },
  slate: { dot: "bg-slate-400", bar: "bg-slate-400", label: "Slate" },
};
