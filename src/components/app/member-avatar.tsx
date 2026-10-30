import { cn } from "@/lib/utils";

export function MemberAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const letters =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join("") || "?";
  return avatarUrl ? (
    // Clerk avatar URLs; plain <img> avoids next/image remote config for a 24px icon.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt={name} title={name} className={cn("size-6 rounded-full object-cover", className)} />
  ) : (
    <span
      title={name}
      className={cn("grid size-6 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground", className)}
    >
      {letters}
    </span>
  );
}
