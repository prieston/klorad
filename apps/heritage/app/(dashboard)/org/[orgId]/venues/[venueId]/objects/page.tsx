import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Object records' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-205"
      phase="Phase 1"
      title={'Object records'}
      description={'The metadata form — a form, not an ontology editor. The curator sees fields; the system writes Linked Art JSON-LD aligned to CIDOC-CRM underneath, with controlled vocabularies where they exist, bulk edit and CSV round-trip. The tables behind it exist already, and so does the CRUD API at /api/venues/[venueId]/objects.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
