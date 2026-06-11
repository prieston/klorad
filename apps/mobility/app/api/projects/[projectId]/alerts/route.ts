/**
 * GET /api/projects/[projectId]/alerts
 * Live alerts feed for the operator dashboard. v1 derives alerts on
 * the fly from the source's current status, scoped to devices the
 * operator has flagged `included`. No durable alert engine yet:
 *
 *   1. List the project's included devices.
 *   2. Build the connector for each device's source (memoised per
 *      source so we don't re-decrypt + re-configure on every call).
 *   3. Bulk-fetch status per source via `getStatus(devices[])`.
 *   4. Filter to `online === false || alarm != null`.
 *
 * In fixture mode this serves the seeded alerts (CCTV 991 offline,
 * DMS 891 fault). In live mode it proxies through to the ATMS.
 *
 * Capped at 100 devices per project to keep the cost of an
 * anonymous-ish read bounded; tenants who outgrow this graduate to
 * the durable MobilityAlert engine in a follow-up arc.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "@/lib/mobility/data-source";

type Params = Promise<{ projectId: string }>;

interface AlertRow {
  deviceId: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  customLabel: string | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  agency: string | null;
  kind: "offline" | "alarmed";
  message: string | null;
  observedAt: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const devices = await prisma.mobilityDevice.findMany({
    where: { projectId, included: true },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    select: {
      id: true,
      externalDeviceId: true,
      sourceId: true,
      subsystem: true,
      name: true,
      customLabel: true,
      primaryRoad: true,
      crossRoad: true,
      direction: true,
      agency: true,
    },
  });

  if (devices.length === 0) {
    return NextResponse.json({ alerts: [], totalIncluded: 0 });
  }

  // Group device ids by source so we can batch one connector call
  // per source, not per device.
  const bySource = new Map<string, typeof devices>();
  for (const d of devices) {
    const arr = bySource.get(d.sourceId) ?? [];
    arr.push(d);
    bySource.set(d.sourceId, arr);
  }

  const sources = await prisma.mobilityDataSource.findMany({
    where: { id: { in: Array.from(bySource.keys()) }, enabled: true },
    select: {
      id: true,
      connectorId: true,
      config: true,
      credentialsEncrypted: true,
    },
  });

  const alerts: AlertRow[] = [];
  await Promise.all(
    sources.map(async (source) => {
      let connector;
      try {
        connector = await buildConnector({
          connectorId: source.connectorId,
          config: source.config as DataSourceConfigJson,
          credentials: decryptCredentials(source.credentialsEncrypted),
        });
      } catch {
        return;
      }
      const items = bySource.get(source.id) ?? [];
      // Pack the connector-side ids the same way ingest did
      // (`<subsystem>:<externalId>`). Devices that don't round-trip
      // through the packId convention are skipped.
      const packed = items.map((d) => `${d.subsystem}:${d.externalDeviceId}`);
      let statuses: Awaited<ReturnType<typeof connector.getStatus>>;
      try {
        statuses = await connector.getStatus(packed);
      } catch {
        return;
      }
      for (const d of items) {
        const key = `${d.subsystem}:${d.externalDeviceId}`;
        const s = statuses[key] as
          | { online: boolean; alarm: string | null; observedAt: string }
          | undefined;
        if (!s) continue;
        const offline = !s.online;
        const alarmed = !!s.alarm;
        if (!offline && !alarmed) continue;
        alerts.push({
          deviceId: d.id,
          externalDeviceId: d.externalDeviceId,
          subsystem: d.subsystem,
          name: d.name,
          customLabel: d.customLabel,
          primaryRoad: d.primaryRoad,
          crossRoad: d.crossRoad,
          direction: d.direction,
          agency: d.agency,
          kind: offline ? "offline" : "alarmed",
          message: s.alarm,
          observedAt: s.observedAt,
        });
      }
    }),
  );

  // Sort: offline before alarmed, then most recent observation first.
  alerts.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "offline" ? -1 : 1;
    return Date.parse(b.observedAt) - Date.parse(a.observedAt);
  });

  return NextResponse.json({ alerts, totalIncluded: devices.length });
}
