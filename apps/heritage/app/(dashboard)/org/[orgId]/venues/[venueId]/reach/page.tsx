import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: 'Notification composer' };

export default async function Page({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  return (
    <ComingSoon
      requirement="HER-209"
      phase="Phase 1"
      title={'Notification composer'}
      description={'Compose, target, schedule, send, measure — exhibitions, events, site closures and new digital releases, with no account required to subscribe. Inherited from Campus, where it is already in production; segmentation moves from department to venue and interest.'}
      backHref={`/org/${orgId}/venues/${venueId}`}
      backLabel={'Back to venue overview'}
    />
  );
}
