import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Rights management' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-206"
      phase="Phase 1"
      title={'Rights management'}
      description={'Rights held separately on the source object and on each derivative representation, resolved to the more restrictive of the two, constrained to the closed list of 14 permitted URIs. The resolution rule already ships in lib/heritage/rights.ts and every read path goes through it; what is missing is the screen a curator uses to set them.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
