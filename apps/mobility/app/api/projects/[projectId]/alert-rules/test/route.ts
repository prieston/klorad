/**
 * POST /api/projects/[projectId]/alert-rules/test
 *   Preview whether a proposed rule would fire against the project's
 *   current fleet, without persisting anything. Threshold rules sample
 *   up to 20 devices matching the target subsystem, poll their live
 *   status via the connector, and evaluate the same threshold logic
 *   the webhook consumer uses. Event rules return a note explaining
 *   that they only fire on incoming events — not on current state.
 *
 * Body mirrors `RuleBody` (discriminated on `kind`).
 *
 * Requires project `read` — this only proxies status, never writes.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import {
  RuleBody,
  evaluateThresholdOnStatus,
} from "@/lib/mobility/alert-rules";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "@/lib/mobility/data-source";

type Params = Promise<{ projectId: string }>;

const SAMPLE_LIMIT = 20;

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = RuleBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.kind === "event") {
    return NextResponse.json({
      kind: "event",
      previewSupported: false,
      note:
        "Event rules fire on inbound webhook events, not on current state. Trigger a matching scenario on the mock to test.",
    });
  }

  const cfg = parsed.data.config;

  const devices = await prisma.mobilityDevice.findMany({
    where: { projectId, subsystem: cfg.subsystem },
    orderBy: { lastSeenAt: "desc" },
    take: SAMPLE_LIMIT,
    select: {
      id: true,
      externalDeviceId: true,
      sourceId: true,
      subsystem: true,
      name: true,
      customLabel: true,
    },
  });

  if (devices.length === 0) {
    return NextResponse.json({
      kind: "threshold",
      previewSupported: true,
      sampled: 0,
      matched: 0,
      samples: [],
      note: `No synced devices in subsystem "${cfg.subsystem}" yet.`,
    });
  }

  // Group by source so we make one connector call per source.
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

  const samples: Array<{
    deviceId: string;
    externalDeviceId: string;
    name: string;
    observed: number | null;
    matched: boolean;
  }> = [];

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
          | { raw?: Record<string, unknown> }
          | undefined;
        const outcome = evaluateThresholdOnStatus(s?.raw, cfg);
        samples.push({
          deviceId: d.id,
          externalDeviceId: d.externalDeviceId,
          name: d.customLabel ?? d.name,
          observed: outcome.observed,
          matched: outcome.matched,
        });
      }
    }),
  );

  // Matches first — the operator's eye should land on hits.
  samples.sort((a, b) => Number(b.matched) - Number(a.matched));
  const matched = samples.filter((s) => s.matched).length;

  return NextResponse.json({
    kind: "threshold",
    previewSupported: true,
    sampled: samples.length,
    matched,
    samples,
  });
}
