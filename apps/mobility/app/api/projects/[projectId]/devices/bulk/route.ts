/**
 * POST /api/projects/[projectId]/devices/bulk
 * Apply a curation flag flip to many devices in one round-trip.
 * Body: { deviceIds: string[], action: BulkAction }
 *
 * Used by the Devices table's multi-select toolbar so the operator
 * can curate hundreds of rows without N PATCH calls.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

const Body = z.object({
  deviceIds: z.array(z.string().min(1)).min(1).max(1000),
  action: z.enum([
    "include",
    "exclude",
    "public",
    "private",
    "reviewed",
    "unreviewed",
    /** Discovered queue: stay in catalog but excluded and reviewed —
     *  "no thanks" without losing the row in case a re-sync brings
     *  it back. */
    "reject",
  ]),
});

const ACTION_PATCH: Record<
  z.infer<typeof Body>["action"],
  Record<string, boolean>
> = {
  include: { included: true, needsReview: false },
  exclude: { included: false, isPublic: false },
  public: { isPublic: true, included: true, needsReview: false },
  private: { isPublic: false },
  reviewed: { needsReview: false },
  unreviewed: { needsReview: true },
  reject: { included: false, isPublic: false, needsReview: false },
};

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
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const patch = ACTION_PATCH[parsed.data.action];

  // Scope by projectId in the where clause so a malicious caller
  // can't curate devices from another project even if they guess ids.
  const result = await prisma.mobilityDevice.updateMany({
    where: { id: { in: parsed.data.deviceIds }, projectId },
    data: patch,
  });
  return NextResponse.json({ updated: result.count });
}
