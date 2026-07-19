/**
 * `POST /api/projects/[projectId]/alert-rules/seed-demo` — seed the
 * canonical set of demo rules that pair with the mock's scenario
 * runners (`apps/mock-inet/lib/scenarios.ts`). Idempotent by rule name
 * — an existing rule with the same demo name is skipped, not
 * overwritten, so a repeat click is safe.
 *
 * The four rules cover every trigger the demo panel emits:
 *
 *   Radar jam forming     — threshold radar.occupancy >= 0.7
 *                           (fires on "Radar spike" + "Cascade")
 *   Traffic slowdown      — threshold radar.speed <= 30
 *                           (fires on "Traffic ticker" slowdown + "Cascade")
 *   DMS sign faulted      — threshold dms.shortStatus > 0
 *                           (fires on "DMS alarm" + "Cascade")
 *   New incident posted   — event incident.posted
 *                           (fires on "Incident" + "Cascade")
 *
 * Targets default to every world in the project so a subscribed
 * visitor gets a push straight away. If the project has no worlds
 * the rules still open `MobilityAlert` rows — they just don't push.
 *
 * Requires project `write`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string }>;

interface DemoRuleTemplate {
  name: string;
  kind: "threshold" | "event";
  config: Record<string, unknown>;
}

const DEMO_RULES: DemoRuleTemplate[] = [
  {
    name: "Radar jam forming (demo)",
    kind: "threshold",
    config: {
      subsystem: "radar",
      field: "occupancy",
      op: "gte",
      value: 0.7,
    },
  },
  {
    name: "Traffic slowdown (demo)",
    kind: "threshold",
    config: {
      subsystem: "radar",
      field: "speed",
      op: "lte",
      value: 30,
    },
  },
  {
    name: "DMS sign faulted (demo)",
    kind: "threshold",
    config: {
      subsystem: "dms",
      field: "shortStatus",
      op: "gt",
      value: 0,
    },
  },
  {
    name: "New incident posted (demo)",
    kind: "event",
    config: {
      eventType: "incident.posted",
    },
  },
];

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  // Pull existing demo rules once so we can skip duplicates by name.
  // No unique index on (projectId, name), so simultaneous clicks
  // could still race and double-insert — acceptable for a demo
  // seeder (operator can delete the dupe).
  const existing = await prisma.mobilityAlertRule.findMany({
    where: {
      projectId,
      name: { in: DEMO_RULES.map((r) => r.name) },
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((r) => r.name));

  // Default push target: every world in the project. Empty is fine —
  // the rule still opens MobilityAlert rows, just no push.
  const worlds = await prisma.mobilityWorld.findMany({
    where: { projectId },
    select: { id: true },
  });
  const targets = {
    worldIds: worlds.map((w) => w.id),
  } as unknown as Prisma.InputJsonValue;

  const toCreate = DEMO_RULES.filter((r) => !existingNames.has(r.name));

  const created: Array<{ id: string; name: string }> = [];
  for (const tpl of toCreate) {
    const row = await prisma.mobilityAlertRule.create({
      data: {
        projectId,
        name: tpl.name,
        kind: tpl.kind,
        enabled: true,
        config: tpl.config as unknown as Prisma.InputJsonValue,
        targets,
      },
      select: { id: true, name: true },
    });
    created.push(row);
  }

  return NextResponse.json({
    created: created.length,
    skipped: DEMO_RULES.length - created.length,
    rules: created,
    totalTemplates: DEMO_RULES.length,
  });
}
