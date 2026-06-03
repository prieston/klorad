import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { listDiningForProject, type DiningAnchor } from "@/lib/dining-db";
import { parseHours } from "@/lib/dining-hours";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

/** Normalise the incoming `hours` payload to the JSON shape we
 *  store. Empty / missing returns `null` so the column truly says
 *  "no structured hours" instead of an empty array — the renderer
 *  treats those the same, but `null` is what the rest of the schema
 *  uses for unset values. */
function parseHoursForDb(value: unknown): Prisma.InputJsonValue | null {
  const parsed = parseHours(value);
  return parsed.length > 0 ? (parsed as unknown as Prisma.InputJsonValue) : null;
}

type Params = Promise<{ mapId: string }>;

function parseAnchors(raw: unknown): DiningAnchor[] {
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
    .filter((a): a is DiningAnchor => !!a);
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;
  const locations = await listDiningForProject(mapId);
  return NextResponse.json({ locations });
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

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const created = await prisma.diningLocation.create({
    data: {
      organizationId: project.organizationId,
      projectId: mapId,
      name,
      nameEl,
      description,
      descriptionEl,
      hoursText:
        typeof body.hoursText === "string" && body.hoursText.trim().length > 0
          ? body.hoursText.trim()
          : null,
      hours: parseHoursForDb(body.hours),
      cuisine:
        typeof body.cuisine === "string" && body.cuisine.trim().length > 0
          ? body.cuisine.trim()
          : null,
      menuUrl:
        typeof body.menuUrl === "string" && body.menuUrl.trim().length > 0
          ? body.menuUrl.trim()
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
    entityType: "DINING_LOCATION",
    entityId: created.id,
    action: "CREATED",
    message: `Dining "${name}"`,
  });

  return NextResponse.json({ id: created.id });
}
