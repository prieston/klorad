import { NextResponse } from "next/server";
import { Prisma, type NewsCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ id: string }>;

const VALID_CATEGORIES: NewsCategory[] = ["announcement", "news", "alert"];

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

/**
 * PATCH /api/news/[id] — partial edit. Only the fields present in
 * the body are touched; everything else stays. Dates expect ISO
 * strings; an empty string for `expiresAt` clears the expiry.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const existing = await prisma.newsPost.findUnique({
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

  const data: Prisma.NewsPostUpdateInput = {};

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
  if (typeof body.body === "string") {
    const v = body.body.trim();
    if (!v) {
      return NextResponse.json(
        { error: "body cannot be empty" },
        { status: 400 },
      );
    }
    data.body = v;
  }
  if (VALID_CATEGORIES.includes(body.category as NewsCategory)) {
    data.category = body.category as NewsCategory;
  }
  if (body.publishedAt !== undefined) {
    const d = parseDate(body.publishedAt);
    if (d) data.publishedAt = d;
  }
  if (body.expiresAt !== undefined) {
    data.expiresAt = parseDate(body.expiresAt);
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

  await prisma.newsPost.update({ where: { id }, data });
  revalidateTag(publicCampusTag(existing.projectId));
  return NextResponse.json({ ok: true });
}

/** DELETE /api/news/[id] — remove a post. Admin / member / owner only. */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const post = await prisma.newsPost.findUnique({
    where: { id },
    select: { organizationId: true, projectId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(post.organizationId, "write");
  if (denied) return denied;

  await prisma.newsPost.delete({ where: { id } });
  revalidateTag(publicCampusTag(post.projectId));
  return NextResponse.json({ ok: true });
}
