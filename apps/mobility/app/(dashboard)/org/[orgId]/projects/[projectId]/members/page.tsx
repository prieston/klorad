import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Members" };

export default async function ProjectMembersPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  return (
    <ComingSoon
      eyebrow="Members"
      title="Per-project role overrides."
      description="Same ProjectMember model Campus uses. Promote a viewer to write for one project without changing their org role."
      backHref={`/org/${orgId}/projects/${projectId}`}
      backLabel="Back to operator console"
    />
  );
}
