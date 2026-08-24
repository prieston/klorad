import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Scenes and processing' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-202"
      phase="Phase 1"
      title={'Scenes and processing'}
      description={'Normalise captures to the delivery format, build the level-of-detail tree, tile to 3D Tiles, publish. Every output records the parameters it was produced with, which is where paradata partly comes from automatically.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
