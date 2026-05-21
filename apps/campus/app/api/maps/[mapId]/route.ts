import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;

  const map = await prisma.project.findUnique({
    where: { id: mapId },
    select: {
      id: true,
      title: true,
      sceneData: true,
      updatedAt: true,
      createdAt: true,
      thumbnail: true,
      isPublished: true,
    },
  });

  if (!map) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...map, name: map.title });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mapId } = await params;
  const body = await req.json() as {
    name?: string;
    sceneData?: unknown;
    thumbnail?: string | null;
    isPublished?: boolean;
  };

  const map = await prisma.project.update({
    where: { id: mapId },
    data: {
      ...(body.name !== undefined && { title: body.name }),
      ...(body.sceneData !== undefined && { sceneData: body.sceneData as object }),
      ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      thumbnail: true,
      isPublished: true,
    },
  });

  return NextResponse.json({ ...map, name: map.title });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mapId } = await params;

  await prisma.project.delete({ where: { id: mapId } });

  return new NextResponse(null, { status: 204 });
}
