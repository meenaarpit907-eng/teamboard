/** Clerk role keys look like "org:admin"; the database stores "admin". */
export function normalizeOrgRole(role: string | null | undefined): string {
  if (!role) return "member";
  return role.replace(/^org:/, "") || "member";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeOrgRole(role) === "admin";
}
