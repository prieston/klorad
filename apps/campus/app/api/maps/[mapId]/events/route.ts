import { NextResponse } from "next/server";
import { Prisma, type EventBanner, type EventIcon } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import {
  listEventsForAdmin,
  type EventAnchor,
} from "@/lib/events-db";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ mapId: string }>;

const VALID_BANNER: EventBanner[] = ["purple", "coral", "teal", "pink"];
const VALID_ICON: EventIcon[] = ["music", "trophy", "sprout", "calendar"];

function parseAnchors(raw: unknown): EventAnchor[] {
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
    .filter((a): a is EventAnchor => !!a);
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;
  const events = await listEventsForAdmin(mapId);
  return NextResponse.json({ events });
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

  const title =
    typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const titleEl =
    typeof body.titleEl === "string" && body.titleEl.trim().length > 0
      ? body.titleEl.trim()
      : null;
  const descriptionEl =
    typeof body.descriptionEl === "string" &&
    body.descriptionEl.trim().length > 0
      ? body.descriptionEl.trim()
      : null;
  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);

  if (!title || !description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 },
    );
  }
  if (!startsAt || !endsAt) {
    return NextResponse.json(
      { error: "startsAt and endsAt are required" },
      { status: 400 },
    );
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    return NextResponse.json(
      { error: "endsAt must be after startsAt" },
      { status: 400 },
    );
  }

  const bannerColor: EventBanner = VALID_BANNER.includes(
    body.bannerColor as EventBanner,
  )
    ? (body.bannerColor as EventBanner)
    : "purple";
  const bannerIcon: EventIcon = VALID_ICON.includes(
    body.bannerIcon as EventIcon,
  )
    ? (body.bannerIcon as EventIcon)
    : "calendar";

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const created = await prisma.eventPost.create({
    data: {
      organizationId: project.organizationId,
      projectId: mapId,
      title,
      titleEl,
      description,
      descriptionEl,
      startsAt,
      endsAt,
      bannerColor,
      bannerIcon,
      imageUrl:
        typeof body.imageUrl === "string" && body.imageUrl.length > 0
          ? body.imageUrl
          : null,
      registrationUrl:
        typeof body.registrationUrl === "string" &&
        body.registrationUrl.length > 0
          ? body.registrationUrl
          : null,
      organizer:
        typeof body.organizer === "string" && body.organizer.length > 0
          ? body.organizer
          : null,
      expectedAttendance:
        typeof body.expectedAttendance === "number"
          ? body.expectedAttendance
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
    entityType: "EVENT_POST",
    entityId: created.id,
    action: "CREATED",
    message: `Event "${title}"`,
    metadata: { startsAt: startsAt.toISOString() },
  });

  return NextResponse.json({ id: created.id });
}
