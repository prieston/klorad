/**
 * GET /api/projects/[projectId]/members
 * Cross-reference the project's org members with any
 * `ProjectMember` override rows, so the UI can render each person's
 * effective role on this project in one place.
 *
 * Each row carries:
 *   - the user's org-level role (always present — they wouldn't be
 *     in the list otherwise)
 *   - the optional override (`role` when set, "blocked" when null,
 *     `null` when no row)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  const myUserId = session?.user?.id as string | undefined;

  const [orgMembers, overrides, myMembership] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true, role: true, createdAt: true },
    }),
    myUserId
      ? prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: project.organizationId,
              userId: myUserId,
            },
          },
          select: { role: true },
        })
      : Promise.resolve(null),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.userId, o]));

  return NextResponse.json({
    members: orgMembers.map((m) => {
      const o = overrideMap.get(m.user.id);
      // null row.role = explicit block; absence = no override
      const overrideKind: "none" | "blocked" | "role" =
        !o ? "none" : o.role === null ? "blocked" : "role";
      return {
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        joinedAt: m.createdAt.toISOString(),
        orgRole: m.role,
        override:
          overrideKind === "none"
            ? null
            : overrideKind === "blocked"
              ? "blocked"
              : o!.role,
      };
    }),
    yourOrgRole: myMembership?.role ?? null,
  });
}
