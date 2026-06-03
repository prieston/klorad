import { NextResponse } from "next/server";
import type { OrganizationRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";

type Params = Promise<{ mapId: string; userId: string }>;

/** Roles the override accepts as the `role` field, in addition to
 *  `null` (block). The whitelist matches the OrganizationRole enum
 *  exactly so a typo in the request body doesn't silently elevate. */
const ALLOWED_ROLES: OrganizationRole[] = [
  "owner",
  "admin",
  "member",
  "publicViewer",
];

/**
 * `PUT /api/maps/[mapId]/members/[userId]` — upsert a per-campus
 * override. Body:
 *   `{ role: "owner" | "admin" | "member" | "publicViewer" | null }`
 *
 * `role: null` is the explicit block — the user keeps their org
 * membership but can't reach this campus. Owners are exempt; an
 * override on the org owner is rejected with 400 because the authz
 * helper ignores it anyway and we'd rather not store a confusing
 * row.
 *
 * Manage-gated: only org owners + admins can mutate overrides.
 */
export async function PUT(req: Request, { params }: { params: Params }) {
  const { mapId, userId } = await params;
  const denied = await requireCampusAccess(mapId, "manage");
  if (denied) return denied;

  let body: { role?: unknown } = {};
  try {
    body = (await req.json()) as { role?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const role = body.role;
  if (
    role !== null &&
    (typeof role !== "string" ||
      !ALLOWED_ROLES.includes(role as OrganizationRole))
  ) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Block targeting the org owner — overrides on owners would be
  // confusingly inert (the authz helper short-circuits before
  // looking at overrides for owners). Reject loudly instead.
  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }
  const orgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: project.organizationId,
        userId,
      },
    },
  });
  if (!orgMember) {
    return NextResponse.json(
      { error: "Target user is not an organization member" },
      { status: 404 },
    );
  }
  if (orgMember.role === "owner") {
    return NextResponse.json(
      { error: "Owners can't have per-campus overrides" },
      { status: 400 },
    );
  }

  const upserted = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: mapId, userId } },
    create: {
      projectId: mapId,
      userId,
      role: role as OrganizationRole | null,
    },
    update: { role: role as OrganizationRole | null },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const session = await auth();
  const targetName =
    upserted.user.name?.trim() ||
    upserted.user.email?.split("@")[0] ||
    "a member";
  await recordAudit({
    organizationId: project.organizationId,
    projectId: mapId,
    actorId: (session?.user?.id as string | undefined) ?? null,
    entityType: "PROJECT_MEMBER",
    entityId: upserted.id,
    action: role === null ? "REMOVED" : "UPDATED",
    message:
      role === null
        ? `Blocked ${targetName} from this campus`
        : `Set ${targetName}'s role to ${humanRole(role as OrganizationRole)}`,
    metadata: { targetUserId: userId, role: role as string | null },
  });

  return NextResponse.json({ ok: true });
}

const ROLE_LABEL: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Editor",
  publicViewer: "Viewer",
};
function humanRole(role: OrganizationRole): string {
  return ROLE_LABEL[role];
}

/**
 * `DELETE /api/maps/[mapId]/members/[userId]` — drop the override.
 * The user reverts to their org-level role for this campus.
 * Manage-gated.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Params },
) {
  const { mapId, userId } = await params;
  const denied = await requireCampusAccess(mapId, "manage");
  if (denied) return denied;

  const existing = await prisma.projectMember
    .findUnique({
      where: { projectId_userId: { projectId: mapId, userId } },
      include: {
        user: { select: { name: true, email: true } },
      },
    })
    .catch(() => null);

  await prisma.projectMember
    .delete({
      where: { projectId_userId: { projectId: mapId, userId } },
    })
    .catch(() => undefined);

  if (existing) {
    const project = await prisma.project.findUnique({
      where: { id: mapId },
      select: { organizationId: true },
    });
    if (project) {
      const session = await auth();
      const targetName =
        existing.user.name?.trim() ||
        existing.user.email?.split("@")[0] ||
        "a member";
      await recordAudit({
        organizationId: project.organizationId,
        projectId: mapId,
        actorId: (session?.user?.id as string | undefined) ?? null,
        entityType: "PROJECT_MEMBER",
        entityId: existing.id,
        action: "REMOVED",
        message: `Reverted ${targetName} to organisation role`,
        metadata: { targetUserId: userId },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
