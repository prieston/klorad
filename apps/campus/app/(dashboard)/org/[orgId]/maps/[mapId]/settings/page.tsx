import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusSettingsPageClient from "./CampusSettingsPageClient";

export default async function CampusSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return <CampusSettingsPageClient orgId={orgId} mapId={mapId} />;
}
