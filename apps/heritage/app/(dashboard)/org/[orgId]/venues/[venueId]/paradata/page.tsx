import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Paradata' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-204"
      phase="Phase 1"
      title={'Paradata'}
      description={'Per representation: capture device and method, processing chain, date, operator, and the complexity degree and intended purpose the capture was made for. Partly auto-populated by the processing pipeline, because paradata that depends entirely on curator diligence does not get recorded. This is the requirement most likely to be cut under schedule pressure and the one that makes the platform credible to a curator.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
