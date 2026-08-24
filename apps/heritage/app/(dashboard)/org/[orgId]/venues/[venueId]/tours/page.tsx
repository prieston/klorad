import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Tour and story builder' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-207"
      phase="Phase 1"
      title={'Tour and story builder'}
      description={'Author a tour by placing stops in a scene, attach media per stop per language, and preview as a visitor on a screen and in a headset. One definition drives both. The tour and stop tables and their API exist; the builder does not.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
