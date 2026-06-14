/**
 * Set the device membership of a world wholesale.
 *
 *   PUT /api/worlds/[worldId]/devices
 *     Body: { deviceIds: string[] }
 *
 * Replace-semantics: the supplied list is the new full membership.
 * Anything not in the list is removed; anything new is inserted.
 * Wrapped in a transaction so the operator never observes a
 * half-applied state. Device ids that don't belong to the world's
 * project are filtered out before write — quietly, since they're
 * almost always a stale client-side selection from a project switch.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ worldId: string }>;

const PutBody = z.object({
  deviceIds: z.array(z.string()).max(5_000),
});

export async function PUT(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;

  const world = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: { projectId: true },
  });
  if (!world) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(world.projectId, "write");
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

  // Validate every device id belongs to this project before writing.
  // A stray id from a different project would otherwise create a join
  // row that violates the project boundary even though no constraint
  // catches it directly.
  const requested = Array.from(new Set(parsed.data.deviceIds));
  const valid = requested.length
    ? await prisma.mobilityDevice.findMany({
        where: { id: { in: requested }, projectId: world.projectId },
        select: { id: true },
      })
    : [];
  const validIds = new Set(valid.map((d) => d.id));

  await prisma.$transaction([
    prisma.mobilityWorldDevice.deleteMany({
      where: {
        worldId,
        // Trim anything no longer in the requested set.
        deviceId: { notIn: Array.from(validIds) },
      },
    }),
    // `createMany` with `skipDuplicates` handles the inserts cleanly
    // because of the composite PK.
    prisma.mobilityWorldDevice.createMany({
      data: Array.from(validIds).map((deviceId) => ({ worldId, deviceId })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json({ ok: true, count: validIds.size });
}
