/**
 * PATCH  /api/projects/[projectId]/members/[userId]
 *   Body: { override: "owner" | "admin" | "member" | "publicViewer" |
 *           "blocked" | null }
 *   Upserts a `ProjectMember` row for the user.
 *     - role: OrganizationRole → sets that role override
 *     - "blocked" → sets `role = null` (explicit block)
 *     - null → deletes the override row entirely (falls back to org)
 *
 * Org owners are exempt from per-project blocks: setting override to
 * "blocked" on a user whose org role is owner is a no-op (returns
 * 409). The dashboard also disables the relevant UI for owners.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import type { OrganizationRole } from "@prisma/client";

type Params = Promise<{ projectId: string; userId: string }>;

const Body = z.object({
  override: z.union([
    z.enum(["owner", "admin", "member", "publicViewer", "blocked"]),
    z.null(),
  ]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId, userId } = await params;
  const denied = await requireProjectAccess(projectId, "manage");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Verify the user is actually an org member of the project's org —
  // can't override a role for someone who doesn't have org access.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const orgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: project.organizationId,
        userId,
      },
    },
    select: { role: true },
  });
  if (!orgMember) {
    return NextResponse.json(
      { error: "User is not a member of this organisation" },
      { status: 409 },
    );
  }

  if (parsed.data.override === null) {
    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });
    return NextResponse.json({ ok: true });
  }

  // Owners can't be blocked at the project level — they own the org.
  if (parsed.data.override === "blocked" && orgMember.role === "owner") {
    return NextResponse.json(
      { error: "Owners can't be blocked from a project" },
      { status: 409 },
    );
  }

  const role: OrganizationRole | null =
    parsed.data.override === "blocked"
      ? null
      : (parsed.data.override as OrganizationRole);

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });
  return NextResponse.json({ ok: true });
}
