import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess, requireOrgAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { publicCampusTag } from "@/lib/public-campus";

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
      isPublic: true,
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

  const body = (await req.json()) as {
    name?: string;
    sceneData?: unknown;
    thumbnail?: string | null;
    isPublished?: boolean;
    isPublic?: boolean;
  };

  // Snapshot the prior state so the audit row can attribute what
  // moved. Cheap (single PK lookup); the savings come from giving
  // the dashboard "What Changed" feed real semantics ("Published"
  // vs "Card image updated") instead of one generic "Updated".
  const prior = await prisma.project.findUnique({
    where: { id: mapId },
    select: {
      organizationId: true,
      title: true,
      isPublished: true,
      isPublic: true,
      thumbnail: true,
    },
  });
  if (!prior) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const map = await prisma.project.update({
    where: { id: mapId },
    data: {
      ...(body.name !== undefined && { title: body.name }),
      ...(body.sceneData !== undefined && {
        sceneData: body.sceneData as object,
      }),
      ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail }),
      ...(body.isPublished !== undefined && {
        isPublished: body.isPublished,
      }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      thumbnail: true,
      isPublished: true,
      isPublic: true,
    },
  });

  // The public home / map cache this campus's read; invalidate just
  // this campus's entry so an owner's save shows up promptly (and one
  // tenant's edits don't thrash every other campus's cache).
  revalidateTag(publicCampusTag(mapId));

  // Decide the right audit row. Publish state is the loudest signal
  // — call it out explicitly. Otherwise infer the dominant change
  // and fall back to "Settings updated".
  const session = await auth();
  const actorId = (session?.user?.id as string | undefined) ?? null;
  const auditCommon = {
    organizationId: prior.organizationId,
    projectId: mapId,
    actorId,
    entityType: "PROJECT" as const,
    entityId: mapId,
  };
  if (
    body.isPublished !== undefined &&
    body.isPublished !== prior.isPublished
  ) {
    if (body.isPublished) {
      await recordAudit({
        ...auditCommon,
        action: "PUBLISHED",
        message: `Published ${map.title}`,
      });
    } else {
      await recordAudit({
        ...auditCommon,
        action: "UPDATED",
        message: `Unpublished ${map.title}`,
      });
    }
  } else if (body.name !== undefined && body.name !== prior.title) {
    await recordAudit({
      ...auditCommon,
      action: "RENAMED",
      message: `Renamed campus to "${map.title}"`,
    });
  } else if (
    body.thumbnail !== undefined &&
    body.thumbnail !== prior.thumbnail
  ) {
    await recordAudit({
      ...auditCommon,
      action: "UPDATED",
      message: "Card image updated",
    });
  } else if (
    body.isPublic !== undefined &&
    body.isPublic !== prior.isPublic
  ) {
    await recordAudit({
      ...auditCommon,
      action: "UPDATED",
      message: body.isPublic
        ? "Campus is now public"
        : "Campus now requires sign-in",
    });
  } else if (body.sceneData !== undefined) {
    await recordAudit({
      ...auditCommon,
      action: "UPDATED",
      message: "Settings updated",
    });
  }

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

  const prior = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true, title: true },
  });

  await prisma.project.delete({ where: { id: mapId } });

  // Without this the public cache would keep serving the deleted
  // campus for up to 60s.
  revalidateTag(publicCampusTag(mapId));

  if (prior) {
    const session = await auth();
    await recordAudit({
      organizationId: prior.organizationId,
      projectId: mapId,
      actorId: (session?.user?.id as string | undefined) ?? null,
      entityType: "PROJECT",
      entityId: mapId,
      action: "DELETED",
      message: `Deleted campus "${prior.title}"`,
    });
  }

  return new NextResponse(null, { status: 204 });
}
