import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: 'Organisation overview' };

export default async function Page({ params }: { params: Params }) {
  const { orgId } = await params;
  return (
    <ComingSoon
      requirement="HER-601"
      phase="Phase 1"
      title={'Organisation overview'}
      description={"Cross-venue rollup: what is published, what is pending ingest, and where the record has gaps. The per-venue version of this already renders on each venue's overview."}
      backHref={`/org/${orgId}`}
      backLabel={'Back to venues'}
    />
  );
}
