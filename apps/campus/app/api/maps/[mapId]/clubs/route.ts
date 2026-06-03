import { NextResponse } from "next/server";
import { Prisma, type ClubColor } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import {
  deriveInitials,
  listClubsForAdmin,
  type ClubAnchor,
} from "@/lib/clubs-db";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ mapId: string }>;

const VALID_COLORS: ClubColor[] = ["purple", "coral", "teal", "pink"];

function parseAnchors(raw: unknown): ClubAnchor[] {
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
    .filter((a): a is ClubAnchor => !!a);
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;
  const clubs = await listClubsForAdmin(mapId);
  return NextResponse.json({ clubs });
}

export async function POST(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!name || !description) {
    return NextResponse.json(
      { error: "name and description are required" },
      { status: 400 },
    );
  }
  const nameEl =
    typeof body.nameEl === "string" && body.nameEl.trim().length > 0
      ? body.nameEl.trim()
      : null;
  const descriptionEl =
    typeof body.descriptionEl === "string" &&
    body.descriptionEl.trim().length > 0
      ? body.descriptionEl.trim()
      : null;

  const initials =
    typeof body.initials === "string" && body.initials.trim().length > 0
      ? body.initials.trim().slice(0, 3).toUpperCase()
      : deriveInitials(name);

  const avatarColor: ClubColor = VALID_COLORS.includes(
    body.avatarColor as ClubColor,
  )
    ? (body.avatarColor as ClubColor)
    : "purple";

  const memberCount =
    typeof body.memberCount === "number" && body.memberCount >= 0
      ? Math.floor(body.memberCount)
      : 0;
  const popularityScore =
    typeof body.popularityScore === "number" ? body.popularityScore : 0;

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const created = await prisma.club.create({
    data: {
      organizationId: project.organizationId,
      projectId: mapId,
      name,
      nameEl,
      description,
      descriptionEl,
      initials,
      avatarColor,
      memberCount,
      popularityScore,
      meetsCadence:
        typeof body.meetsCadence === "string" &&
        body.meetsCadence.trim().length > 0
          ? body.meetsCadence.trim()
          : null,
      externalLink:
        typeof body.externalLink === "string" &&
        body.externalLink.trim().length > 0
          ? body.externalLink.trim()
          : null,
      imageUrl:
        typeof body.imageUrl === "string" && body.imageUrl.length > 0
          ? body.imageUrl
          : null,
      anchors: parseAnchors(body.anchors) as unknown as Prisma.InputJsonValue,
    },
  });

  revalidateTag(publicCampusTag(mapId));

  const session = await auth();
  await recordAudit({
    organizationId: project.organizationId,
    projectId: mapId,
    actorId: (session?.user?.id as string | undefined) ?? null,
    entityType: "CLUB",
    entityId: created.id,
    action: "CREATED",
    message: `Club "${name}"`,
  });

  return NextResponse.json({ id: created.id });
}
