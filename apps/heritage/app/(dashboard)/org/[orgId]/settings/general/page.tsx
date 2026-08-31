import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: 'Organisation settings' };

export default async function Page({ params }: { params: Params }) {
  const { orgId } = await params;
  return (
    <ComingSoon
      requirement="HER-208"
      phase="Phase 1"
      title={'Organisation settings'}
      description={'Organisation name, branding and app-level configuration. Shared with the rest of the Klorad platform rather than rebuilt here.'}
      backHref={`/org/${orgId}`}
      backLabel={'Back to venues'}
    />
  );
}
