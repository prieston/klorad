import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ id: string }>;

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const location = await prisma.diningLocation.findUnique({
    where: { id },
    select: { organizationId: true, projectId: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(location.organizationId, "write");
  if (denied) return denied;
  await prisma.diningLocation.delete({ where: { id } });
  revalidateTag(publicCampusTag(location.projectId));
  return NextResponse.json({ ok: true });
}
