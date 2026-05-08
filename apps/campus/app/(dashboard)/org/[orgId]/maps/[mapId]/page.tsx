import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusProfileClient from "./CampusProfileClient";

export default async function CampusProfilePage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const { orgId, mapId } = await params;
  return <CampusProfileClient orgId={orgId} mapId={mapId} />;
}
