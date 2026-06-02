import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CampusHomePageClient from "./CampusHomePageClient";

export default async function CampusHomePage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { orgId, mapId } = await params;
  return <CampusHomePageClient orgId={orgId} mapId={mapId} />;
}
