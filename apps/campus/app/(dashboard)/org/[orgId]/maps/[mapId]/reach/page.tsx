import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusReachPageClient from "./CampusReachPageClient";

export default async function CampusReachPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return (
    <CampusReachPageClient
      orgId={orgId}
      mapId={mapId}
      vapidEnabled={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
    />
  );
}
