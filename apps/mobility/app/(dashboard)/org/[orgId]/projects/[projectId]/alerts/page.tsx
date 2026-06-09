import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Alerts" };

export default async function AlertsPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  return (
    <ComingSoon
      eyebrow="Alerts"
      title="Operational alert feed."
      description="Devices offline past threshold, sustained alarm states, ack workflow. Pushed to subscribed operators via web push."
      backHref={`/org/${orgId}/projects/${projectId}`}
      backLabel="Back to operator console"
    />
  );
}
