import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id as string, organizationId: orgId },
    include: { organization: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    organization: {
      id: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug ?? null,
      isPersonal: member.organization.isPersonal ?? false,
      userRole: member.role,
    },
  });
}

/**
 * PATCH: update name/slug (owners and admins only). Slug cannot be changed
 * for personal organizations.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    slug?: unknown;
  };

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id as string, organizationId: orgId },
    include: { organization: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json(
      { error: "Only owners and admins can update the organization" },
      { status: 403 }
    );
  }

  const update: { name?: string; slug?: string } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    update.name = trimmed;
  }

  if (typeof body.slug === "string") {
    if (membership.organization.isPersonal) {
      return NextResponse.json(
        { error: "Personal organization slug cannot be changed" },
        { status: 400 }
      );
    }
    const slug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug can only contain lowercase letters, numbers, hyphens, and underscores" },
        { status: 400 }
      );
    }
    // Check uniqueness if changed
    if (slug !== membership.organization.slug) {
      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing) {
        return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
      }
    }
    update.slug = slug;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: update,
    select: { id: true, name: true, slug: true, isPersonal: true },
  });

  return NextResponse.json({
    organization: {
      ...updated,
      userRole: membership.role,
    },
  });
}
