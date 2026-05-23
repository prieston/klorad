import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess, requireOrgAccess } from "@/lib/authz";
import { CAMPUS_CACHE_TAG } from "@/lib/public-campus";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;

  const map = await prisma.project.findUnique({
    where: { id: mapId },
    select: {
      id: true,
      title: true,
      sceneData: true,
      updatedAt: true,
      createdAt: true,
      thumbnail: true,
      isPublished: true,
      organizationId: true,
    },
  });

  if (!map) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Published campuses are public (the public viewer fetches this).
  // Drafts are visible only to organization members.
  if (!map.isPublished) {
    const denied = await requireOrgAccess(map.organizationId, "read");
    if (denied) return denied;
  }

  return NextResponse.json({ ...map, name: map.title });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;

  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  const body = await req.json() as {
    name?: string;
    sceneData?: unknown;
    thumbnail?: string | null;
    isPublished?: boolean;
  };

  const map = await prisma.project.update({
    where: { id: mapId },
    data: {
      ...(body.name !== undefined && { title: body.name }),
      ...(body.sceneData !== undefined && { sceneData: body.sceneData as object }),
      ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      thumbnail: true,
      isPublished: true,
    },
  });

  // The public home / map cache this campus's read; invalidate it so
  // an owner's save shows up on the public side promptly.
  revalidateTag(CAMPUS_CACHE_TAG);

  return NextResponse.json({ ...map, name: map.title });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;

  // Deleting a whole campus is owner/admin only.
  const denied = await requireCampusAccess(mapId, "manage");
  if (denied) return denied;

  await prisma.project.delete({ where: { id: mapId } });

  return new NextResponse(null, { status: 204 });
}
