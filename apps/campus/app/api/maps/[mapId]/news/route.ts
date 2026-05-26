import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import {
  listNewsForAdmin,
  type NewsAnchor,
} from "@/lib/news";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";
import { Prisma, type NewsCategory } from "@prisma/client";

type Params = Promise<{ mapId: string }>;

const VALID_CATEGORIES: NewsCategory[] = ["announcement", "news", "alert"];

/** Normalise the JSON body's anchors into clean rows. */
function parseAnchors(raw: unknown): NewsAnchor[] {
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
    .filter((a): a is NewsAnchor => !!a);
}

/** Coerce a string / Date / undefined into a valid Date, or fall back. */
function parseDate(value: unknown, fallback?: Date): Date | null {
  if (value == null || value === "") return fallback ?? null;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? (fallback ?? null) : d;
  }
  return fallback ?? null;
}

/** GET /api/maps/[mapId]/news — admin listing (everything, including drafts). */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  const posts = await listNewsForAdmin(mapId);
  return NextResponse.json({ posts });
}

/**
 * POST /api/maps/[mapId]/news — create a news post on this campus.
 * Body: { title, body, category?, publishedAt?, expiresAt?, anchors?, imageUrl? }
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim() : "";
  const post = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || !post) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 },
    );
  }

  const category: NewsCategory = VALID_CATEGORIES.includes(
    body.category as NewsCategory,
  )
    ? (body.category as NewsCategory)
    : "announcement";

  const publishedAt = parseDate(body.publishedAt, new Date()) ?? new Date();
  const expiresAt = parseDate(body.expiresAt);

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const created = await prisma.newsPost.create({
    data: {
      organizationId: project.organizationId,
      projectId: mapId,
      title,
      body: post,
      category,
      publishedAt,
      expiresAt,
      // Prisma's `Json` input wants `InputJsonValue`; our typed array
      // is a `JsonArray` shape so the cast is safe.
      anchors: parseAnchors(body.anchors) as unknown as Prisma.InputJsonValue,
      imageUrl:
        typeof body.imageUrl === "string" && body.imageUrl.length > 0
          ? body.imageUrl
          : null,
    },
  });

  // Public surface caches per token — bust this campus's tag so the
  // new post shows up immediately without waiting for the 60 s TTL.
  revalidateTag(publicCampusTag(mapId));

  return NextResponse.json({ id: created.id });
}
