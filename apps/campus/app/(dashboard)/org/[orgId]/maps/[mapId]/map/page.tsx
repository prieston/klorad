import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusMapPageClient from "./CampusMapPageClient";

export default async function CampusMapPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return <CampusMapPageClient orgId={orgId} mapId={mapId} />;
}
