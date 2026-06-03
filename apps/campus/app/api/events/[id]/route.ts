import { NextResponse } from "next/server";
import { Prisma, type EventBanner, type EventIcon } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ id: string }>;

const VALID_BANNER: EventBanner[] = ["purple", "coral", "teal", "pink"];
const VALID_ICON: EventIcon[] = ["music", "trophy", "sprout", "calendar"];

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

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** PATCH /api/events/[id] — partial edit. */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const existing = await prisma.eventPost.findUnique({
    where: { id },
    select: { organizationId: true, projectId: true, startsAt: true, endsAt: true },
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

  const data: Prisma.EventPostUpdateInput = {};

  if (typeof body.title === "string") {
    const v = body.title.trim();
    if (!v) {
      return NextResponse.json(
        { error: "title cannot be empty" },
        { status: 400 },
      );
    }
    data.title = v;
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
  if (body.titleEl !== undefined) {
    data.titleEl =
      typeof body.titleEl === "string" && body.titleEl.trim().length > 0
        ? body.titleEl.trim()
        : null;
  }
  if (body.descriptionEl !== undefined) {
    data.descriptionEl =
      typeof body.descriptionEl === "string" &&
      body.descriptionEl.trim().length > 0
        ? body.descriptionEl.trim()
        : null;
  }

  // Validate start/end together so we never accept end < start.
  const newStart = parseDate(body.startsAt) ?? existing.startsAt;
  const newEnd = parseDate(body.endsAt) ?? existing.endsAt;
  if (newEnd.getTime() < newStart.getTime()) {
    return NextResponse.json(
      { error: "endsAt must be after startsAt" },
      { status: 400 },
    );
  }
  if (body.startsAt !== undefined) data.startsAt = newStart;
  if (body.endsAt !== undefined) data.endsAt = newEnd;

  if (VALID_BANNER.includes(body.bannerColor as EventBanner)) {
    data.bannerColor = body.bannerColor as EventBanner;
  }
  if (VALID_ICON.includes(body.bannerIcon as EventIcon)) {
    data.bannerIcon = body.bannerIcon as EventIcon;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.length > 0
        ? body.imageUrl
        : null;
  }
  if (body.registrationUrl !== undefined) {
    data.registrationUrl =
      typeof body.registrationUrl === "string" && body.registrationUrl.length > 0
        ? body.registrationUrl
        : null;
  }
  if (body.organizer !== undefined) {
    data.organizer =
      typeof body.organizer === "string" && body.organizer.length > 0
        ? body.organizer
        : null;
  }
  if (body.expectedAttendance !== undefined) {
    data.expectedAttendance =
      typeof body.expectedAttendance === "number"
        ? body.expectedAttendance
        : null;
  }
  if (Array.isArray(body.anchors)) {
    data.anchors = parseAnchors(body.anchors) as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.eventPost.update({ where: { id }, data });
  revalidateTag(publicCampusTag(existing.projectId));

  const session = await auth();
  await recordAudit({
    organizationId: existing.organizationId,
    projectId: existing.projectId,
    actorId: (session?.user?.id as string | undefined) ?? null,
    entityType: "EVENT_POST",
    entityId: id,
    action: "UPDATED",
    message: `Event "${updated.title}"`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const event = await prisma.eventPost.findUnique({
    where: { id },
    select: {
      organizationId: true,
      projectId: true,
      title: true,
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(event.organizationId, "write");
  if (denied) return denied;
  await prisma.eventPost.delete({ where: { id } });
  revalidateTag(publicCampusTag(event.projectId));

  const session = await auth();
  await recordAudit({
    organizationId: event.organizationId,
    projectId: event.projectId,
    actorId: (session?.user?.id as string | undefined) ?? null,
    entityType: "EVENT_POST",
    entityId: id,
    action: "DELETED",
    message: `Event "${event.title}"`,
  });

  return NextResponse.json({ ok: true });
}
