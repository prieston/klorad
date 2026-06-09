import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Overview" };

export default async function OrgDashboardOverview({
  params,
}: {
  params: Params;
}) {
  const { orgId } = await params;
  return (
    <ComingSoon
      eyebrow="Overview"
      title="Organisation overview."
      description="At-a-glance counters: projects, sources synced, devices online, recent alerts. Lands in the next pass."
      backHref={`/org/${orgId}`}
      backLabel="Back to projects"
    />
  );
}
