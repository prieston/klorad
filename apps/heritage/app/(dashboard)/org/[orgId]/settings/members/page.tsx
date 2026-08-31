import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: 'Team' };

export default async function Page({ params }: { params: Params }) {
  const { orgId } = await params;
  return (
    <ComingSoon
      requirement="HER-208"
      phase="Phase 1"
      title={'Team'}
      description={'Who can author, review and publish in this organisation. Shared with the rest of the Klorad platform rather than rebuilt here.'}
      backHref={`/org/${orgId}`}
      backLabel={'Back to venues'}
    />
  );
}
