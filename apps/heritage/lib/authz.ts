import { NextResponse } from "next/server";
import type { OrganizationRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Heritage authorisation.
 *
 * Same structure as apps/campus/lib/authz.ts and apps/mobility/lib/authz.ts —
 * the tenant model is the shared `Project`, so the access resolver collapses
 * to one shape across verticals. Heritage adds one resolver on top:
 * `requireVenueAccess`, which walks HeritageVenue → Project → Organization so
 * route handlers under `/api/venues/[venueId]/...` do not each have to repeat
 * the join.
 *
 * Access tiers:
 *   - read    any org member
 *   - write   owner / admin / member (curators); not publicViewer
 *   - manage  owner / admin only (destructive / org-level actions)
 *
 * `ProjectMember.role = NULL` is an explicit per-project block. Owners are
 * exempt from per-project blocks.
 */
export type AccessMode = "read" | "write" | "manage";

const WRITE_ROLES: OrganizationRole[] = ["owner", "admin", "member"];
const MANAGE_ROLES: OrganizationRole[] = ["owner", "admin"];

function roleAllows(role: OrganizationRole, mode: AccessMode): boolean {
  if (mode === "read") return true;
  if (mode === "write") return WRITE_ROLES.includes(role);
  return MANAGE_ROLES.includes(role);
}

const forbidden = () =>
  NextResponse.json(
    { error: "You don't have permission to do that" },
    { status: 403 },
  );

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
  return roleAllows(membership.role, mode) ? null : forbidden();
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
    return roleAllows("owner", mode) ? null : forbidden();
  }
  if (override) {
    if (override.role === null) {
      return NextResponse.json(
        { error: "You don't have access to this venue" },
        { status: 403 },
      );
    }
    return roleAllows(override.role, mode) ? null : forbidden();
  }
  return roleAllows(orgMember.role, mode) ? null : forbidden();
}

/**
 * Resolve a HeritageVenue to its Project and apply the same check. Returns the
 * denial response, or `{ projectId, organizationId }` on success, so a handler
 * can scope subsequent queries without a second lookup.
 */
export async function requireVenueAccess(
  venueId: string,
  mode: AccessMode,
): Promise<
  | { denied: NextResponse; venue?: undefined }
  | { denied: null; venue: { projectId: string; organizationId: string } }
> {
  // Authenticate before the lookup. Resolving the venue first would answer
  // 404 for an id that does not exist and 401 for one that does, handing an
  // unauthenticated caller an existence oracle over every tenant's venue ids.
  const session = await auth();
  if (!session?.user?.id) {
    return {
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { projectId: true, project: { select: { organizationId: true } } },
  });
  if (!venue) {
    return {
      denied: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  const denied = await requireProjectAccess(venue.projectId, mode);
  if (denied) return { denied };
  return {
    denied: null,
    venue: {
      projectId: venue.projectId,
      organizationId: venue.project.organizationId,
    },
  };
}
