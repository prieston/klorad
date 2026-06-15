/**
 * Per-project custom icon library.
 *
 *   GET  /api/projects/[projectId]/styles/icons
 *     List the operator's uploaded icons.
 *
 *   POST /api/projects/[projectId]/styles/icons
 *     Register an icon that the browser has already PUT to Spaces.
 *     Body: { url, contentType, bytes, label }
 *     Returns the new row so the picker can include it immediately.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const icons = await prisma.mobilityCustomIcon.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      url: true,
      contentType: true,
      bytes: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    icons: icons.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

const PostBody = z.object({
  url: z.string().url(),
  contentType: z.enum([
    "image/svg+xml",
    "image/png",
    "image/jpeg",
    "image/webp",
  ]),
  bytes: z.number().int().min(1).max(512 * 1024),
  label: z.string().min(1).max(60),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const icon = await prisma.mobilityCustomIcon.create({
    data: {
      projectId,
      label: parsed.data.label,
      url: parsed.data.url,
      contentType: parsed.data.contentType,
      bytes: parsed.data.bytes,
    },
    select: {
      id: true,
      label: true,
      url: true,
      contentType: true,
      bytes: true,
      createdAt: true,
    },
  });
  return NextResponse.json(
    { icon: { ...icon, createdAt: icon.createdAt.toISOString() } },
    { status: 201 },
  );
}
