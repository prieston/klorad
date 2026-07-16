/**
 * PATCH  /api/projects/[projectId]/alert-rules/[ruleId] — update.
 * DELETE /api/projects/[projectId]/alert-rules/[ruleId] — remove.
 *
 * Requires project `write`.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { RuleBody, RuleTargets } from "@/lib/mobility/alert-rules";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string; ruleId: string }>;

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    enabled: z.boolean().optional(),
    targets: RuleTargets.optional(),
  })
  .and(z.union([z.object({}), RuleBody]));

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId, ruleId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  const rule = await prisma.mobilityAlertRule.findFirst({
    where: { id: ruleId, projectId },
    select: { id: true },
  });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Prisma's typed update accepts only the fields we set — build the
  // patch conditionally so unspecified fields aren't reset to defaults.
  const data: Prisma.MobilityAlertRuleUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if ("kind" in parsed.data) {
    data.kind = parsed.data.kind;
    data.config = parsed.data.config as unknown as Prisma.InputJsonValue;
  }
  if (parsed.data.targets !== undefined) {
    data.targets = parsed.data.targets as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.mobilityAlertRule.update({
    where: { id: ruleId },
    data,
    select: {
      id: true,
      name: true,
      sourceId: true,
      enabled: true,
      kind: true,
      config: true,
      targets: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId, ruleId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  const rule = await prisma.mobilityAlertRule.findFirst({
    where: { id: ruleId, projectId },
    select: { id: true },
  });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.mobilityAlertRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
