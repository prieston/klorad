import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Devices" };

export default async function DevicesPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  return (
    <ComingSoon
      eyebrow="Devices"
      title="Bulk curation table."
      description="All devices in one filterable, sortable table; bulk toggle included / public / mark reviewed. Faster than clicking through the operator drawer one at a time."
      backHref={`/org/${orgId}/projects/${projectId}`}
      backLabel="Back to operator console"
    />
  );
}
