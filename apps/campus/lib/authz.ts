import { NextResponse } from "next/server";
import type { OrganizationRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Campus authorization.
 *
 * Access is derived from `OrganizationMember.role`:
 *   - read   — any member of the organization
 *   - write  — owner / admin / member (editors); not `publicViewer`
 *   - manage — owner / admin only (destructive / org-level actions)
 *
 * The `require*` helpers return a `NextResponse` to send back when the
 * caller is denied, or `null` when access is granted. Usage in a route:
 *
 *   const denied = await requireCampusAccess(mapId, "write");
 *   if (denied) return denied;
 */
export type AccessMode = "read" | "write" | "manage";

const WRITE_ROLES: OrganizationRole[] = ["owner", "admin", "member"];
const MANAGE_ROLES: OrganizationRole[] = ["owner", "admin"];

function roleAllows(role: OrganizationRole, mode: AccessMode): boolean {
  if (mode === "read") return true;
  if (mode === "write") return WRITE_ROLES.includes(role);
  return MANAGE_ROLES.includes(role);
}

/**
 * Require the caller to be a member of `orgId` with rights for `mode`.
 * Returns the denial response, or `null` if allowed.
 */
export async function requireOrgAccess(
  orgId: string,
  mode: AccessMode,
): Promise<NextResponse | null> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this organization" },
      { status: 403 },
    );
  }
  if (!roleAllows(membership.role, mode)) {
    return NextResponse.json(
      { error: "You don't have permission to do that" },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Require `mode` rights on the campus's organization. Resolves the
 * campus → its organization, then defers to {@link requireOrgAccess}.
 */
export async function requireCampusAccess(
  mapId: string,
  mode: AccessMode,
): Promise<NextResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }
  return requireOrgAccess(project.organizationId, mode);
}
