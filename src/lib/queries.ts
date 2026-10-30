import "server-only";
import type { TypedClient } from "@/lib/supabase/server";

export type Member = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

/** Members of the active org (RLS limits memberships/profiles to it). */
export async function getMembers(supabase: TypedClient): Promise<Member[]> {
  const [{ data: memberships }, { data: profiles }] = await Promise.all([
    supabase.from("memberships").select("user_id, role"),
    supabase.from("profiles").select("id, email, full_name, avatar_url"),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (memberships ?? [])
    .map((m) => {
      const p = byId.get(m.user_id);
      return {
        id: m.user_id,
        name: p?.full_name || p?.email || "Unknown member",
        email: p?.email ?? null,
        avatarUrl: p?.avatar_url ?? null,
        role: m.role,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function initials(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join("") || "?"
  );
}
