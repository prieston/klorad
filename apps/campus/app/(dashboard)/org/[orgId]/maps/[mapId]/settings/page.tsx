import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function MapSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const { orgId, mapId } = await params;
  return <SettingsClient orgId={orgId} mapId={mapId} />;
}
