import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusMembersPageClient from "./CampusMembersPageClient";

export default async function CampusMembersPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return <CampusMembersPageClient orgId={orgId} mapId={mapId} />;
}
