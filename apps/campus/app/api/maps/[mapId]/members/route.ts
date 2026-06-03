import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";

type Params = Promise<{ mapId: string }>;

/**
 * `GET /api/maps/[mapId]/members` — campus-tier members list.
 *
 * Returns every org member alongside their *effective* role on this
 * campus: the org-level role unless a `ProjectMember` override is
 * set. Owners are always shown as owners regardless of any
 * override row (blocks are ignored for owners).
 *
 * The shape mirrors what the campus-tier `/members` screen needs:
 *
 *   {
 *     members: [{
 *       id, userId, role,            // raw org membership row
 *       override: "owner" | "admin" | "member" | "publicViewer" | "blocked" | null,
 *       effectiveRole: OrganizationRole | "blocked",
 *       user: { id, name, email, image }
 *     }]
 *   }
 *
 * Read-gated. We surface this rather than the org-tier list because
 * the campus screen is allowed to be seen by every org member, but
 * only owners + admins can mutate overrides — see PUT/DELETE below.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ members: [] }, { status: 404 });
  }

  const [orgMembers, overrides] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: project.organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.projectMember.findMany({
      where: { projectId: mapId },
      select: { userId: true, role: true },
    }),
  ]);

  const overrideByUser = new Map(
    overrides.map((o) => [o.userId, o.role] as const),
  );

  const members = orgMembers.map((m) => {
    const hasOverride = overrideByUser.has(m.userId);
    const overrideRole = overrideByUser.get(m.userId) ?? null;
    // Owners ignore blocks; nothing else changes for them.
    const isOwner = m.role === "owner";
    const override = !hasOverride
      ? null
      : overrideRole === null
        ? ("blocked" as const)
        : overrideRole;
    const effectiveRole =
      isOwner || !hasOverride
        ? m.role
        : overrideRole === null
          ? ("blocked" as const)
          : overrideRole;
    return {
      id: m.id,
      userId: m.userId,
      role: m.role,
      override,
      effectiveRole,
      user: m.user,
    };
  });

  return NextResponse.json({ members });
}
