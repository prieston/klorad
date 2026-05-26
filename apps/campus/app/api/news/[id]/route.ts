import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";

type Params = Promise<{ id: string }>;

/** DELETE /api/news/[id] — remove a post. Admin / member / owner only. */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const post = await prisma.newsPost.findUnique({
    where: { id },
    select: { organizationId: true, projectId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireOrgAccess(post.organizationId, "write");
  if (denied) return denied;

  await prisma.newsPost.delete({ where: { id } });
  revalidateTag(publicCampusTag(post.projectId));
  return NextResponse.json({ ok: true });
}
