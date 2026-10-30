import { OrganizationProfile } from "@clerk/nextjs";

export const metadata = { title: "Team" };

/** Members, roles and invitations are managed by Clerk's OrganizationProfile. */
export default function TeamPage() {
  return (
    <div className="flex justify-center">
      <OrganizationProfile routing="path" path="/app/team" afterLeaveOrganizationUrl="/app" />
    </div>
  );
}
