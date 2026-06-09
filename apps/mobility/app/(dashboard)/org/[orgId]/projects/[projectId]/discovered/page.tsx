import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Discovered devices" };

export default async function DiscoveredPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  return (
    <ComingSoon
      eyebrow="Discovered devices"
      title="Inbox for newly-synced devices."
      description="Every re-sync surfaces new devices here for triage. Bulk include / publish / reject before they reach the operator console."
      backHref={`/org/${orgId}/projects/${projectId}`}
      backLabel="Back to operator console"
    />
  );
}
