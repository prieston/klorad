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
      source: {
        select: {
          label: true,
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

  /** Build the upstream URLs the connector hits for this device so the
   *  drawer can show them as a debug aid. Currently iNET-specific; if
   *  we add more connector types the pattern moves into a connector
   *  method (`describeUrls()` or similar). */
  function describeSource() {
    const config = device!.source.config as { host?: string } | null;
    const host = (config?.host ?? "").replace(/\/$/, "");
    if (device!.source.connectorId !== "inet-atms" || !host) {
      return {
        label: device!.source.label,
        connectorId: device!.source.connectorId,
        host: host || null,
        urls: { device: null, status: null, list: null },
      };
    }
    const subsystem = device!.subsystem;
    // Defensive: older rows still hold the packed id `cctv:24432`
    // from before the runner was fixed. Strip the prefix at URL
    // build time so the URL panel works even for not-yet-resynced
    // catalogues.
    const externalId = device!.externalDeviceId.startsWith(`${subsystem}:`)
      ? device!.externalDeviceId.slice(subsystem.length + 1)
      : device!.externalDeviceId;
    const base = `${host}/atms/${subsystem}-rest/rest/${subsystem}`;
    return {
      label: device!.source.label,
      connectorId: device!.source.connectorId,
      host,
      urls: {
        list: `${base}/`,
        device: `${base}/${externalId}`,
        // Every iNET subsystem the connector talks to now exposes a
        // per-id /status endpoint (mock or upstream) — surface the
        // URL so the drawer's debug panel is honest about where the
        // live payload came from.
        status: `${base}/${externalId}/status`,
      },
    };
  }
  const source = describeSource();

  // All subsystems — call the connector's getStatus. The adapter keys
  // results by the *packed* id (e.g. `dms:21413`), so build that
  // explicitly. Subsystems whose upstream doesn't implement /status
  // return an empty record and the drawer shows "no live data" — the
  // connector's fan-out already tolerates 404s.
  try {
    const connector = await buildConnector({
      connectorId: device.source.connectorId,
      config: device.source.config as DataSourceConfigJson,
      credentials: decryptCredentials(device.source.credentialsEncrypted),
    });
    // Same defensive strip — pre-fix rows have the prefix already.
    const externalId = device.externalDeviceId.startsWith(`${device.subsystem}:`)
      ? device.externalDeviceId.slice(device.subsystem.length + 1)
      : device.externalDeviceId;
    const packed = `${device.subsystem}:${externalId}`;
    const statuses = await connector.getStatus([packed]);
    const status = statuses[packed] ?? null;
    return NextResponse.json({ status, source });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown", source },
      { status: 502 },
    );
  }
}
