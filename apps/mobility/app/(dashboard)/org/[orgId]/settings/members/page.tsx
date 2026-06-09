import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Team" };

export default async function OrgMembersPage({
  params,
}: {
  params: Params;
}) {
  const { orgId } = await params;
  return (
    <ComingSoon
      eyebrow="Team"
      title="Invite teammates."
      description="Org members, roles, invitations. Same primitives as Campus — lands in the next pass."
      backHref={`/org/${orgId}`}
      backLabel="Back to projects"
    />
  );
}
