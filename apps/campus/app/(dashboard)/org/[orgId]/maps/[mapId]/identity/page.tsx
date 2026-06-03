import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusIdentityPageClient from "./CampusIdentityPageClient";

export default async function CampusIdentityPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return <CampusIdentityPageClient orgId={orgId} mapId={mapId} />;
}
