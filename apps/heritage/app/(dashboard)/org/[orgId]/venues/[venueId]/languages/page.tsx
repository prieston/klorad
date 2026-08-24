import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Translation workflow' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-210"
      phase="Phase 1"
      title={'Translation workflow'}
      description={"AI-assisted drafting and translation into the venue's languages, with human approval before publication, never automatic. Already in production in Campus. Every content field here is stored as a per-language map, so the data side is ready."}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
