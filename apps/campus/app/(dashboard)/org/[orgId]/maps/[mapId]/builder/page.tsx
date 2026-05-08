import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BuilderClient from "./BuilderClient";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const { mapId } = await params;
  return <BuilderClient mapId={mapId} />;
}
