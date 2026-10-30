import "server-only";
import { auth } from "@clerk/nextjs/server";
import { isAdminRole, normalizeOrgRole } from "@/lib/roles";

export type WorkspaceContext = {
  userId: string;
  orgId: string;
  orgRole: string;
  isAdmin: boolean;
};

/** The signed-in user and their ACTIVE Clerk organization, or null. */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return null;
  return { userId, orgId, orgRole: normalizeOrgRole(orgRole), isAdmin: isAdminRole(orgRole) };
}
