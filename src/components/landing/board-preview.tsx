const columns = [
  {
    title: "To do",
    cards: [
      { title: "Invite design team", tag: "high", tagClass: "bg-amber-400/15 text-amber-300" },
      { title: "Org-scoped storage policies", tag: "urgent", tagClass: "bg-rose-400/15 text-rose-300" },
    ],
  },
  {
    title: "In progress",
    cards: [
      { title: "Realtime board sync", tag: "medium", tagClass: "bg-sky-400/15 text-sky-300" },
      { title: "Weekly digest Edge Function", tag: "high", tagClass: "bg-amber-400/15 text-amber-300" },
    ],
  },
  {
    title: "Done",
    cards: [{ title: "Clerk third-party auth", tag: "done", tagClass: "bg-emerald-400/15 text-emerald-300" }],
  },
];

/** Static illustration of the board for the landing page (no data). */
export function BoardPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl" aria-hidden>
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-primary/40 to-transparent" />
      <div className="relative rounded-2xl border bg-card/90 p-4 text-left shadow-2xl backdrop-blur sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-md bg-violet-500/80 text-[10px] font-semibold">AS</span>
            <span className="font-medium">Acme Studio</span>
            <span className="text-muted-foreground">/ Website relaunch</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title} className="rounded-xl bg-muted/40 p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{col.title}</p>
              <div className="space-y-2">
                {col.cards.map((card) => (
                  <div key={card.title} className="rounded-lg border bg-background/80 p-3">
                    <p className="text-sm">{card.title}</p>
                    <span className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${card.tagClass}`}>
                      {card.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
