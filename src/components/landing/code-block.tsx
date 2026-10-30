export function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-[oklch(0.12_0.006_285)]">
      <figcaption className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </span>
        <span className="font-mono">{title}</span>
      </figcaption>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </figure>
  );
}
