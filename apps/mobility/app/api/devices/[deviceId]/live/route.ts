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
      externalDeviceId: true,
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

  try {
    const connector = await buildConnector({
      connectorId: device.source.connectorId,
      config: device.source.config as DataSourceConfigJson,
      credentials: decryptCredentials(device.source.credentialsEncrypted),
    });
    const statuses = await connector.getStatus([device.externalDeviceId]);
    const status = statuses[device.externalDeviceId] ?? null;
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 502 },
    );
  }
}
