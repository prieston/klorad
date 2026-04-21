import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const maps = await prisma.project.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json(maps.map((m) => ({ ...m, name: m.title })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, name } = await req.json() as { orgId: string; name: string };
  if (!orgId || !name) return NextResponse.json({ error: "orgId and name required" }, { status: 400 });

  const map = await prisma.project.create({
    data: {
      title: name,
      organizationId: orgId,
      engine: "mapbox",
      sceneData: {},
    },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json({ ...map, name: map.title }, { status: 201 });
}
