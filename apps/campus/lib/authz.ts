import { NextResponse } from "next/server";
import type { OrganizationRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Campus authorization.
 *
 * Access is layered: per-campus override (when present) wins over
 * org-level role. The override model lives on `ProjectMember`:
 *   - row with `role` = some role → use that role instead of the
 *     user's org role for this campus
 *   - row with `role` = NULL → explicit block (denied even if the
 *     org role would otherwise allow access)
 *   - no row → fall through to `OrganizationMember.role`
 *
 * Owners are exempt from per-campus blocks — they own the org and
 * by extension every campus inside it. The campus-tier Members UI
 * disables the override controls for owners to make this explicit.
 *
 * Role tiers:
 *   - read   — any member of the organization
 *   - write  — owner / admin / member (editors); not `publicViewer`
 *   - manage — owner / admin only (destructive / org-level actions)
 *
 * The `require*` helpers return a `NextResponse` to send back when
 * the caller is denied, or `null` when access is granted. Usage in
 * a route:
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
 * Require the caller to be a member of `orgId` with rights for
 * `mode`. Returns the denial response, or `null` if allowed.
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
 * Require `mode` rights on a campus. Resolves to the campus's org,
 * checks the caller is a member, then layers any
 * `ProjectMember` override on top:
 *
 *   override role  | org role  | effective
 *   -------------- | --------- | -----------------------------
 *   (no row)       | owner     | owner
 *   (no row)       | member    | member
 *   admin          | member    | admin (override promotes)
 *   member         | admin     | member (override demotes)
 *   NULL (block)   | member    | blocked
 *   NULL (block)   | owner     | owner (owners bypass blocks)
 */
export async function requireCampusAccess(
  mapId: string,
  mode: AccessMode,
): Promise<NextResponse | null> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One round-trip for the project + org membership + override.
  // Override is keyed by (projectId, userId); orgMember by
  // (organizationId, userId). We don't have either id yet, so the
  // project read comes first, then a parallel read of the other two.
  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const [orgMember, override] = await Promise.all([
    prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId,
        },
      },
    }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: mapId, userId } },
    }),
  ]);

  if (!orgMember) {
    return NextResponse.json(
      { error: "You are not a member of this organization" },
      { status: 403 },
    );
  }

  // Owners are immune to per-campus blocks — they own the org and
  // can always reach into every campus.
  if (orgMember.role === "owner") {
    return roleAllows("owner", mode)
      ? null
      : NextResponse.json(
          { error: "You don't have permission to do that" },
          { status: 403 },
        );
  }

  if (override) {
    if (override.role === null) {
      // Explicit block.
      return NextResponse.json(
        { error: "You don't have access to this campus" },
        { status: 403 },
      );
    }
    return roleAllows(override.role, mode)
      ? null
      : NextResponse.json(
          { error: "You don't have permission to do that" },
          { status: 403 },
        );
  }

  return roleAllows(orgMember.role, mode)
    ? null
    : NextResponse.json(
        { error: "You don't have permission to do that" },
        { status: 403 },
      );
}
