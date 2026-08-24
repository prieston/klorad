import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Visitor analytics' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-601"
      phase="Phase 1"
      title={'Visitor analytics'}
      description={'Which venues, objects and tours draw attention. Where visitors move, stop and give up. Consent-gated and aggregated by default — non-essential analytics require prior consent independently of the GDPR basis, and the reject path has to be as easy as the accept path.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
