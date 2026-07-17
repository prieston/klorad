import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveWorldForViewer } from "@/lib/mobility/world-resolver";
import { WorldAccessDenied } from "../WorldAccessDenied";
import { DevicesList } from "./DevicesList";

type Params = Promise<{ slug: string }>;

export const metadata = { title: "Devices" };

/**
 * `/w/[slug]/devices` — mobile device list tab for the world PWA.
 * Same visibility branching as the parent `/w/[slug]` — public /
 * linkOnly worlds render for anyone; authenticated worlds gate on
 * `MobilityWorldPrincipal`.
 */
export default async function WorldDevicesPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const session = await auth();
  const viewerId = (session?.user?.id as string | undefined) ?? null;
  const result = await resolveWorldForViewer(slug, viewerId);

  if (result.kind === "not_found") notFound();
  if (result.kind === "needs_signin") {
    const callback = encodeURIComponent(`/w/${slug}/devices`);
    redirect(`/auth/signin?callbackUrl=${callback}`);
  }
  if (result.kind === "no_access") {
    return <WorldAccessDenied slug={slug} />;
  }

  return <DevicesList slug={result.world.slug} devices={result.world.devices} />;
}
