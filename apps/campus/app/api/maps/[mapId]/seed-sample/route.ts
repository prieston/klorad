import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import {
  projectHasContent,
  seedSampleCampus,
} from "@/lib/sample-seed";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ mapId: string }>;

/**
 * POST /api/maps/[mapId]/seed-sample
 *
 * Writes a starter set of news + events + clubs + dining into this
 * project so a fresh campus doesn't open onto empty rails. Refuses
 * to seed twice — checks `projectHasContent(projectId)` first and
 * 409s if the project already has anything; callers wanting to
 * re-seed are responsible for deleting the existing rows.
 */
export async function POST(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  if (await projectHasContent(mapId)) {
    return NextResponse.json(
      {
        error:
          "This campus already has content — delete the existing news / events / clubs / dining before re-seeding.",
      },
      { status: 409 },
    );
  }

  try {
    const counts = await seedSampleCampus(mapId, project.organizationId);
    revalidateTag(publicCampusTag(mapId));
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    console.error("[seed-sample] failed", err);
    return NextResponse.json(
      { error: "Failed to seed sample data" },
      { status: 500 },
    );
  }
}
