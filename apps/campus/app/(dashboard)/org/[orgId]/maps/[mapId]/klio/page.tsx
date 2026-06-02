import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusKlioPageClient from "./CampusKlioPageClient";

export default async function CampusKlioPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return <CampusKlioPageClient orgId={orgId} mapId={mapId} />;
}
