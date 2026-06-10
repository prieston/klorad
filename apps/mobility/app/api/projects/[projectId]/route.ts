/**
 * GET    /api/projects/[projectId] — single project (used by the
 *                                    sidebar context header).
 * PATCH  /api/projects/[projectId] — update title / publish flags /
 *                                    sceneData. Mirrors Campus's
 *                                    per-campus PATCH.
 * DELETE /api/projects/[projectId] — drop the project. Cascading FK
 *                                    deletes drop its data sources,
 *                                    devices, statuses + alerts.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string }>;

const PatchBody = z.object({
  title: z.string().min(1).max(120).optional(),
  isPublished: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  /** Public-facing logo / hero. Persisted on the Project row, not in
   *  sceneData, so the public surface can read it without parsing
   *  the engine blob. */
  thumbnail: z.string().url().nullable().optional(),
  sceneData: z.record(z.unknown()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      isPublished: true,
      isPublic: true,
      thumbnail: true,
      sceneData: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
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
  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data: Prisma.ProjectUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.isPublished !== undefined) {
    data.isPublished = parsed.data.isPublished;
  }
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;
  if (parsed.data.thumbnail !== undefined) data.thumbnail = parsed.data.thumbnail;
  if (parsed.data.sceneData !== undefined) {
    data.sceneData = parsed.data.sceneData as Prisma.InputJsonValue;
  }
  await prisma.project.update({ where: { id: projectId }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "manage");
  if (denied) return denied;
  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
