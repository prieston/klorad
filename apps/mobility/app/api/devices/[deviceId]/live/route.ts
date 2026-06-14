/**
 * GET /api/devices/[deviceId]/live
 * Fetch the device's current status via its source connector,
 * proxy-style. The browser never talks directly to the ATMS;
 * credentials stay server-side, response stays bounded.
 *
 * Returns the connector's InetStatus shape (or whatever the adapter
 * returns; we forward it verbatim under `status`).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "@/lib/mobility/data-source";

type Params = Promise<{ deviceId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { deviceId } = await params;
  const device = await prisma.mobilityDevice.findUnique({
    where: { id: deviceId },
    select: {
      projectId: true,
      subsystem: true,
      externalDeviceId: true,
      payload: true,
      lastSeenAt: true,
      source: {
        select: {
          connectorId: true,
          config: true,
          credentialsEncrypted: true,
        },
      },
    },
  });
  if (!device) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(device.projectId, "read");
  if (denied) return denied;

  // CCTV — iNET exposes no per-id status endpoint. The "live" signal
  // is the video stream itself plus the device's `active` flag from
  // the last sync; synthesise a status from the cached payload so
  // the drawer doesn't show "No live data" for every camera.
  if (device.subsystem === "cctv") {
    const payload = device.payload as Record<string, unknown> | null;
    const active =
      payload && typeof payload.active === "boolean"
        ? (payload.active as boolean)
        : true;
    return NextResponse.json({
      status: {
        online: active,
        alarm: null,
        observedAt: device.lastSeenAt.toISOString(),
        raw: {
          active,
          note:
            "CCTV has no per-device status endpoint; live signal is the stream.",
        },
      },
    });
  }

  // DMS — call the connector's getStatus. The adapter keys results
  // by the *packed* id (e.g. `dms:21413`), so build that explicitly.
  try {
    const connector = await buildConnector({
      connectorId: device.source.connectorId,
      config: device.source.config as DataSourceConfigJson,
      credentials: decryptCredentials(device.source.credentialsEncrypted),
    });
    const packed = `${device.subsystem}:${device.externalDeviceId}`;
    const statuses = await connector.getStatus([packed]);
    const status = statuses[packed] ?? null;
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 502 },
    );
  }
}
