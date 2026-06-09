/**
 * GET /api/orgs/[orgId] — single org by id. Used by the org switcher
 * to render the currently-selected org's name + slug.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";

type Params = Promise<{ orgId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "read");
  if (denied) return denied;

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });
  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ organization });
}
