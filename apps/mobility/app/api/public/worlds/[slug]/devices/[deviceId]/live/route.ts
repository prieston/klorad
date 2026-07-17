/**
 * GET /api/public/worlds/[slug]/devices/[deviceId]/live
 *
 * Public live-status proxy for a device in a specific world. Gate
 * matches the other `/api/public/worlds/[slug]/*` endpoints (via
 * `loadWorldForPushViewer`) — public/linkOnly worlds are open,
 * authenticated worlds require a granted session. Verifies the
 * device is actually in the world before proxying, so a leaked
 * device id from a different world can't be probed here.
 *
 * Response body is a subset of the operator `/api/devices/[id]/live`
 * shape — no `source.urls` debug info leaks to public callers.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadWorldForPushViewer } from "@/lib/mobility/world-resolver";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "@/lib/mobility/data-source";

type Params = Promise<{ slug: string; deviceId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { slug, deviceId } = await params;
  const world = await loadWorldForPushViewer(slug);
  if (!world) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Two joins in one query: is the device in this world, and if so
  // what source does it belong to? Faster + safer than a two-hop
  // fetch (device.projectId + MobilityWorldDevice check).
  const membership = await prisma.mobilityWorldDevice.findFirst({
    where: {
      worldId: world.id,
      deviceId,
    },
    select: {
      device: {
        select: {
          id: true,
          subsystem: true,
          externalDeviceId: true,
          payload: true,
          source: {
            select: {
              connectorId: true,
              config: true,
              credentialsEncrypted: true,
            },
          },
        },
      },
    },
  });
  if (!membership?.device) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { device } = membership;

  // Extract the media hint the connector wrote at sync time. Same
  // shape the operator drawer reads (`payload.media`) so the
  // visitor's rich detail sheet can render a video / snapshot
  // without a second round-trip.
  const payload = (device.payload ?? {}) as Record<string, unknown>;
  const media =
    payload.media && typeof payload.media === "object"
      ? (payload.media as Record<string, unknown>)
      : null;

  try {
    const connector = await buildConnector({
      connectorId: device.source.connectorId,
      config: device.source.config as DataSourceConfigJson,
      credentials: decryptCredentials(device.source.credentialsEncrypted),
    });
    // Same defensive strip as the operator endpoint — pre-fix rows
    // still have the packed prefix.
    const externalId = device.externalDeviceId.startsWith(
      `${device.subsystem}:`,
    )
      ? device.externalDeviceId.slice(device.subsystem.length + 1)
      : device.externalDeviceId;
    const packed = `${device.subsystem}:${externalId}`;
    const statuses = await connector.getStatus([packed]);
    const status = statuses[packed] ?? null;
    return NextResponse.json({ status, media });
  } catch (err) {
    return NextResponse.json(
      {
        status: null,
        media,
        error: err instanceof Error ? err.message : "Unknown",
      },
      { status: 502 },
    );
  }
}
