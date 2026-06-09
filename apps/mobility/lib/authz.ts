import { NextResponse } from "next/server";
import type { OrganizationRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Mobility authorisation.
 *
 * Identical structure to apps/campus/lib/authz.ts (per Decision 1
 * the tenant model is shared `Project`, so the access resolver
 * collapses to one shape across verticals). The naming differs only
 * to read naturally inside Mobility route handlers:
 * `requireProjectAccess(projectId, mode)`.
 *
 * Access tiers:
 *   - read   any org member
 *   - write  owner / admin / member (operators); not publicViewer
 *   - manage owner / admin only (destructive / org-level actions)
 *
 * `ProjectMember.role = NULL` is an explicit per-project block.
 * Owners are exempt from per-project blocks.
 */
export type AccessMode = "read" | "write" | "manage";

const WRITE_ROLES: OrganizationRole[] = ["owner", "admin", "member"];
const MANAGE_ROLES: OrganizationRole[] = ["owner", "admin"];

function roleAllows(role: OrganizationRole, mode: AccessMode): boolean {
  if (mode === "read") return true;
  if (mode === "write") return WRITE_ROLES.includes(role);
  return MANAGE_ROLES.includes(role);
}

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
      { error: "You are not a member of this organisation" },
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

export async function requireProjectAccess(
  projectId: string,
  mode: AccessMode,
): Promise<NextResponse | null> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      where: { projectId_userId: { projectId, userId } },
    }),
  ]);

  if (!orgMember) {
    return NextResponse.json(
      { error: "You are not a member of this organisation" },
      { status: 403 },
    );
  }
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
      return NextResponse.json(
        { error: "You don't have access to this project" },
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
