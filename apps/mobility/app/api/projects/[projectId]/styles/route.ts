/**
 * Per-project device styles.
 *
 *   GET  /api/projects/[projectId]/styles
 *     Returns the operator's saved rows + the project's distinct
 *     subsystems so the UI can render a chip per subsystem without a
 *     second round-trip.
 *
 *   PUT  /api/projects/[projectId]/styles
 *     Body: { styles: Array<{ subsystem, iconKey }> }
 *     Replace-semantics for the whole set; missing subsystems are
 *     wiped so reverting to the default is one click on the UI.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import {
  STOCK_DEVICE_ICONS,
  defaultIconKeyForSubsystem,
} from "@/lib/mobility/device-icons";
import { listProjectSubsystems } from "@/lib/mobility/device-style-resolver";

type Params = Promise<{ projectId: string }>;

const STOCK_KEYS = new Set(STOCK_DEVICE_ICONS.map((entry) => entry.key));

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const [subsystems, rows] = await Promise.all([
    listProjectSubsystems(projectId),
    prisma.mobilityDeviceStyle.findMany({
      where: { projectId },
      select: { subsystem: true, iconKey: true },
    }),
  ]);

  const overrides = new Map(rows.map((r) => [r.subsystem, r.iconKey]));
  const styles = subsystems.map((subsystem) => ({
    subsystem,
    iconKey: overrides.get(subsystem) ?? defaultIconKeyForSubsystem(subsystem),
    isOverride: overrides.has(subsystem),
  }));

  return NextResponse.json({ styles });
}

const PutBody = z.object({
  styles: z
    .array(
      z.object({
        subsystem: z.string().min(1).max(40),
        iconKey: z.string().min(1).max(60),
      }),
    )
    .max(200),
});

export async function PUT(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PutBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Stock keys are accepted as-is. `custom:<id>` references must
  // resolve to a MobilityCustomIcon row owned by this project — block
  // any attempt to point at another project's icon.
  const customRefs = parsed.data.styles
    .filter((s) => s.iconKey.startsWith("custom:"))
    .map((s) => s.iconKey.slice("custom:".length));
  const validCustomIds = new Set<string>();
  if (customRefs.length) {
    const rows = await prisma.mobilityCustomIcon.findMany({
      where: { projectId, id: { in: customRefs } },
      select: { id: true },
    });
    for (const r of rows) validCustomIds.add(r.id);
  }
  for (const s of parsed.data.styles) {
    if (s.iconKey.startsWith("custom:")) {
      const id = s.iconKey.slice("custom:".length);
      if (!validCustomIds.has(id)) {
        return NextResponse.json(
          { error: `Custom icon "${id}" is not part of this project.` },
          { status: 400 },
        );
      }
      continue;
    }
    if (!STOCK_KEYS.has(s.iconKey)) {
      return NextResponse.json(
        { error: `Unknown iconKey "${s.iconKey}".` },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction([
    prisma.mobilityDeviceStyle.deleteMany({ where: { projectId } }),
    prisma.mobilityDeviceStyle.createMany({
      data: parsed.data.styles.map((s) => ({
        projectId,
        subsystem: s.subsystem,
        iconKey: s.iconKey,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
