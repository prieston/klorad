/**
 * GET   /api/orgs/[orgId] — single org by id. Used by the org switcher
 *                            and the org settings page.
 * PATCH /api/orgs/[orgId] — update name (slug is immutable; changing it
 *                            would break every member's bookmarks).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
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
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      createdAt: true,
    },
  });
  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ organization });
}

const PatchBody = z.object({
  name: z.string().min(2).max(120),
});

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
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
  await prisma.organization.update({
    where: { id: orgId },
    data: { name: parsed.data.name },
  });
  return NextResponse.json({ ok: true });
}
