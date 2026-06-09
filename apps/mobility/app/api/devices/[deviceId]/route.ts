/**
 * PATCH /api/devices/[deviceId] — curate the device. Body fields:
 *   included?  bool — surfaced in operator console
 *   isPublic?  bool — surfaced on traveller map
 *   customLabel? string — overrides source-supplied name
 *   customRoute? string
 *   groupKey? string
 *   needsReview? bool — usually set to false by the operator
 *
 * First successful curation also clears needsReview automatically
 * so the row drops out of the "Needs review" queue without an
 * extra click.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ deviceId: string }>;

const PatchBody = z.object({
  included: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  customLabel: z.string().max(80).nullable().optional(),
  customRoute: z.string().max(120).nullable().optional(),
  groupKey: z.string().max(80).nullable().optional(),
  needsReview: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { deviceId } = await params;
  const row = await prisma.mobilityDevice.findUnique({
    where: { id: deviceId },
    select: { projectId: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(row.projectId, "write");
  if (denied) return denied;

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

  // First curation clears needsReview automatically unless the
  // operator explicitly opts back in.
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.needsReview === undefined) {
    if (
      parsed.data.included !== undefined ||
      parsed.data.isPublic !== undefined ||
      parsed.data.customLabel !== undefined
    ) {
      data.needsReview = false;
    }
  }

  await prisma.mobilityDevice.update({
    where: { id: deviceId },
    data,
  });
  return NextResponse.json({ ok: true });
}
