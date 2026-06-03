import { NextResponse } from "next/server";
import { Prisma, type ClubColor } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ id: string }>;

const VALID_COLORS: ClubColor[] = ["purple", "coral", "teal", "pink"];

interface AnchorIn {
  kind: "building" | "room";
  refId: string;
  refName: string;
}

function parseAnchors(raw: unknown): AnchorIn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      const r = a as Record<string, unknown>;
      const kind = r.kind === "room" ? "room" : "building";
      const refName =
        typeof r.refName === "string" ? r.refName.trim() : "";
      const refId = typeof r.refId === "string" ? r.refId : "";
      return refName ? { kind, refId, refName } : null;
    })
    .filter((a): a is AnchorIn => !!a);
}

/** PATCH /api/clubs/[id] — partial edit. */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const existing = await prisma.club.findUnique({
    where: { id },
    select: { organizationId: true, projectId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(existing.organizationId, "write");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Prisma.ClubUpdateInput = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) {
      return NextResponse.json(
        { error: "name cannot be empty" },
        { status: 400 },
      );
    }
    data.name = v;
  }
  if (typeof body.description === "string") {
    const v = body.description.trim();
    if (!v) {
      return NextResponse.json(
        { error: "description cannot be empty" },
        { status: 400 },
      );
    }
    data.description = v;
  }
  if (body.nameEl !== undefined) {
    data.nameEl =
      typeof body.nameEl === "string" && body.nameEl.trim().length > 0
        ? body.nameEl.trim()
        : null;
  }
  if (body.descriptionEl !== undefined) {
    data.descriptionEl =
      typeof body.descriptionEl === "string" &&
      body.descriptionEl.trim().length > 0
        ? body.descriptionEl.trim()
        : null;
  }
  if (typeof body.initials === "string" && body.initials.trim().length > 0) {
    data.initials = body.initials.trim().slice(0, 3).toUpperCase();
  }
  if (VALID_COLORS.includes(body.avatarColor as ClubColor)) {
    data.avatarColor = body.avatarColor as ClubColor;
  }
  if (typeof body.memberCount === "number" && body.memberCount >= 0) {
    data.memberCount = Math.floor(body.memberCount);
  }
  if (typeof body.popularityScore === "number") {
    data.popularityScore = body.popularityScore;
  }
  if (body.meetsCadence !== undefined) {
    data.meetsCadence =
      typeof body.meetsCadence === "string" && body.meetsCadence.length > 0
        ? body.meetsCadence
        : null;
  }
  if (body.externalLink !== undefined) {
    data.externalLink =
      typeof body.externalLink === "string" && body.externalLink.length > 0
        ? body.externalLink
        : null;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.length > 0
        ? body.imageUrl
        : null;
  }
  if (Array.isArray(body.anchors)) {
    data.anchors = parseAnchors(body.anchors) as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.club.update({ where: { id }, data });
  revalidateTag(publicCampusTag(existing.projectId));

  const session = await auth();
  await recordAudit({
    organizationId: existing.organizationId,
    projectId: existing.projectId,
    actorId: (session?.user?.id as string | undefined) ?? null,
    entityType: "CLUB",
    entityId: id,
    action: "UPDATED",
    message: `Club "${updated.name}"`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const club = await prisma.club.findUnique({
    where: { id },
    select: {
      organizationId: true,
      projectId: true,
      name: true,
    },
  });
  if (!club) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(club.organizationId, "write");
  if (denied) return denied;
  await prisma.club.delete({ where: { id } });
  revalidateTag(publicCampusTag(club.projectId));

  const session = await auth();
  await recordAudit({
    organizationId: club.organizationId,
    projectId: club.projectId,
    actorId: (session?.user?.id as string | undefined) ?? null,
    entityType: "CLUB",
    entityId: id,
    action: "DELETED",
    message: `Club "${club.name}"`,
  });

  return NextResponse.json({ ok: true });
}
