import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Asset ingest' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-201"
      phase="Phase 1"
      title={'Asset ingest'}
      description={'Upload or connect, with queued processing, visible status, estimated time, and errors a curator can act on. Large-file upload that survives a dropped connection — a curator here uploads a 26 GB point cloud, not a photograph, so ingest is a pipeline with a queue and a state model rather than an upload field.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
