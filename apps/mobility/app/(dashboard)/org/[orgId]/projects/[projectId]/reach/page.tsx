import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Reach" };

export default async function ReachPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  return (
    <ComingSoon
      eyebrow="Reach"
      title="Operator push broadcasts."
      description="Same web-push primitive as Campus, scoped to operator subscribers. For status updates, planned outages, kiosk shift handovers."
      backHref={`/org/${orgId}/projects/${projectId}`}
      backLabel="Back to operator console"
    />
  );
}
