/**
 * POST /api/projects — create a new Mobility tenant Project under
 * the caller's org. Mobility-shaped defaults: engine=mapbox,
 * sceneData carries an empty mobility config slot per
 * MOBILITY_PLAN.md §6 Decision 1 (config in sceneData.mobility,
 * data in relation tables).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import type { Prisma } from "@prisma/client";

const CreateBody = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(120),
});

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const denied = await requireOrgAccess(parsed.data.organizationId, "write");
  if (denied) return denied;

  // Mobility default sceneData carries an empty `mobility` config
  // slot. Per the plan, only light settings (default map centre, the
  // subsystems UI shows) live here; devices / sources never do.
  const sceneData = {
    mobility: {
      defaultCentre: null,
      defaultZoom: null,
      enabledSubsystems: ["cctv", "dms"],
    },
  } as unknown as Prisma.InputJsonValue;

  const created = await prisma.project.create({
    data: {
      organizationId: parsed.data.organizationId,
      title: parsed.data.title,
      engine: "mapbox",
      sceneData,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id });
}
