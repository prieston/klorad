import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveWorldForViewer } from "@/lib/mobility/world-resolver";
import { WorldAccessDenied } from "../WorldAccessDenied";
import { NotificationsList } from "./NotificationsList";

type Params = Promise<{ slug: string }>;

/**
 * `/w/[slug]/notifications` — visitor-facing feed of every broadcast
 * ever sent to this world. Renders server-side (no client fetch) so
 * the first paint has real data.
 *
 * Access follows the same rules as the map (`resolveWorldForViewer`):
 *   public + linkOnly → anyone
 *   authenticated     → sign-in gate + org/principal check
 *
 * Each row includes the deviceIds the alert was scoped to so the
 * client can render a "View on map" deep-link back to
 * `/w/<slug>?devices=id1,id2` — the notification's original tap
 * target.
 */
export default async function NotificationsPage({
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
    const callback = encodeURIComponent(`/w/${slug}/notifications`);
    redirect(`/auth/signin?callbackUrl=${callback}`);
  }
  if (result.kind === "no_access") {
    return <WorldAccessDenied slug={slug} />;
  }

  const world = result.world;

  // The resolver returns the shape needed for the map viewer but not
  // the raw MobilityWorld id — grab it here for the Broadcast filter.
  const worldRow = await prisma.mobilityWorld.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!worldRow) notFound();

  const rows = await prisma.broadcast.findMany({
    where: { worldId: worldRow.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      body: true,
      targetPath: true,
      deviceIds: true,
      createdAt: true,
    },
  });

  // Preload the world's devices so the client can render chips with
  // real names instead of raw IDs. Keeps the notifications page
  // self-contained (no follow-up fetch on tap).
  const deviceIdSet = new Set<string>();
  for (const r of rows) for (const id of r.deviceIds) deviceIdSet.add(id);
  const devices = deviceIdSet.size
    ? await prisma.mobilityDevice.findMany({
        where: { id: { in: Array.from(deviceIdSet) } },
        select: { id: true, name: true, subsystem: true },
      })
    : [];
  const deviceMap = Object.fromEntries(
    devices.map((d) => [d.id, { name: d.name, subsystem: d.subsystem }]),
  );

  return (
    <NotificationsList
      slug={world.slug}
      worldName={world.name}
      items={rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        targetPath: r.targetPath,
        deviceIds: r.deviceIds,
        createdAtIso: r.createdAt.toISOString(),
      }))}
      deviceMap={deviceMap}
    />
  );
}
