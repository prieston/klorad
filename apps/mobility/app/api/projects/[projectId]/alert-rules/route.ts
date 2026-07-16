/**
 * GET  /api/projects/[projectId]/alert-rules — list.
 * POST /api/projects/[projectId]/alert-rules — create. Body validated
 *   against `RuleBody` (discriminated on `kind`) + a `targets` shape.
 *
 * Requires project `write` for create, `read` for list.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { RuleBody, RuleTargets } from "@/lib/mobility/alert-rules";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string }>;

const CreateBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    sourceId: z.string().nullable().optional(),
    targets: RuleTargets.optional(),
    enabled: z.boolean().optional(),
  })
  .and(RuleBody);

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const rules = await prisma.mobilityAlertRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      sourceId: true,
      enabled: true,
      kind: true,
      config: true,
      targets: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ rules });
}

export async function POST(
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
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.sourceId) {
    const src = await prisma.mobilityDataSource.findFirst({
      where: { id: parsed.data.sourceId, projectId },
      select: { id: true },
    });
    if (!src) {
      return NextResponse.json(
        { error: "Source does not belong to this project" },
        { status: 400 },
      );
    }
  }

  const rule = await prisma.mobilityAlertRule.create({
    data: {
      projectId,
      sourceId: parsed.data.sourceId ?? null,
      name: parsed.data.name,
      enabled: parsed.data.enabled ?? true,
      kind: parsed.data.kind,
      config: parsed.data.config as unknown as Prisma.InputJsonValue,
      targets: (parsed.data.targets ?? { worldIds: [] }) as unknown as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      name: true,
      sourceId: true,
      enabled: true,
      kind: true,
      config: true,
      targets: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(rule);
}
