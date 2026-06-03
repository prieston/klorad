import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { parseHours } from "@/lib/dining-hours";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ id: string }>;

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

/** PATCH /api/dining/[id] — partial edit. */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const existing = await prisma.diningLocation.findUnique({
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

  const data: Prisma.DiningLocationUpdateInput = {};

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
  if (body.hoursText !== undefined) {
    data.hoursText =
      typeof body.hoursText === "string" && body.hoursText.length > 0
        ? body.hoursText
        : null;
  }
  if (body.hours !== undefined) {
    const parsed = parseHours(body.hours);
    data.hours =
      parsed.length > 0
        ? (parsed as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
  }
  if (body.cuisine !== undefined) {
    data.cuisine =
      typeof body.cuisine === "string" && body.cuisine.length > 0
        ? body.cuisine
        : null;
  }
  if (body.menuUrl !== undefined) {
    data.menuUrl =
      typeof body.menuUrl === "string" && body.menuUrl.length > 0
        ? body.menuUrl
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

  await prisma.diningLocation.update({ where: { id }, data });
  revalidateTag(publicCampusTag(existing.projectId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const location = await prisma.diningLocation.findUnique({
    where: { id },
    select: { organizationId: true, projectId: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(location.organizationId, "write");
  if (denied) return denied;
  await prisma.diningLocation.delete({ where: { id } });
  revalidateTag(publicCampusTag(location.projectId));
  return NextResponse.json({ ok: true });
}
