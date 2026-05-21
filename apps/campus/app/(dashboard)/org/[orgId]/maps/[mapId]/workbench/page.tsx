import { auth } from "@/auth";
import { redirect } from "next/navigation";
import WorkbenchClient from "./WorkbenchClient";

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { mapId } = await params;
  return <WorkbenchClient mapId={mapId} />;
}
