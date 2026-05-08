import { auth } from "@/auth";
import MapsPageClient from "./MapsPageClient";

export default async function MapsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  return <MapsPageClient orgId={orgId} userId={session!.user!.id as string} />;
}
