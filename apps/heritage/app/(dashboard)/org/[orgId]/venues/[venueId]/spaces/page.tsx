import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Spaces' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-205"
      phase="Phase 1"
      title={'Spaces'}
      description={'Galleries, sectors, rooms and scanned scenes within this venue. The tables and the CRUD API at /api/venues/[venueId]/spaces exist; the authoring surface does not yet.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
