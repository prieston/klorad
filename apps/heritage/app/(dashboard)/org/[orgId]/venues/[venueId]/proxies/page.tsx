import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Proxy and annotation authoring' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-203"
      phase="Phase 1"
      title={'Proxy and annotation authoring'}
      description={'Place invisible proxy geometry in a scene, bind each proxy to an object record, set its label and its interaction. Snap, duplicate, bulk-place, preview as a visitor. A splat cloud contains no objects and a raycast into it hits nothing, so this is the entire interaction layer for a scanned site — the spec says design it first, not last.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
