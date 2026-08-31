import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: 'Compliance dashboard' };

export default async function Page({ params }: { params: Params }) {
  const { orgId } = await params;
  return (
    <ComingSoon
      requirement="HER-501"
      phase="Phase 2"
      title={'Compliance dashboard'}
      description={'Counts of assets by digitised, 3D digitised, standards-conformant, rights-cleared, aggregated and published — filterable by venue and monument class, and expressible against the Commission Recommendation 2021/1970 targets a Member State reports on every two years. This is the screen a ministry buys.'}
      backHref={`/org/${orgId}`}
      backLabel={'Back to venues'}
    />
  );
}
