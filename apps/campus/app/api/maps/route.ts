import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const denied = await requireOrgAccess(orgId, "read");
  if (denied) return denied;

  const maps = await prisma.project.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdAt: true,
      sceneData: true,
      thumbnail: true,
      isPublished: true,
    },
  });

  return NextResponse.json(
    maps.map((m) => {
      // The builder exports scene data as `{ mapboxScene: { center: [lng, lat], ... }, ... }`.
      // Fall back to a top-level `center` for legacy rows that may have been saved differently.
      const scene = (m.sceneData ?? null) as {
        center?: [number, number];
        mapboxScene?: { center?: [number, number] };
      } | null;
      const rawCenter = scene?.mapboxScene?.center ?? scene?.center ?? null;
      const center =
        Array.isArray(rawCenter) &&
        rawCenter.length >= 2 &&
        typeof rawCenter[0] === "number" &&
        typeof rawCenter[1] === "number" &&
        // Skip the default [0, 0] placeholder — treat as "no location set".
        !(rawCenter[0] === 0 && rawCenter[1] === 0)
          ? ([rawCenter[0], rawCenter[1]] as [number, number])
          : null;
      return {
        id: m.id,
        name: m.title,
        title: m.title,
        updatedAt: m.updatedAt,
        createdAt: m.createdAt,
        center,
        thumbnail: m.thumbnail,
        isPublished: m.isPublished,
      };
    })
  );
}

export async function POST(req: Request) {
  const { orgId, name } = await req.json() as { orgId: string; name: string };
  if (!orgId || !name) return NextResponse.json({ error: "orgId and name required" }, { status: 400 });

  const denied = await requireOrgAccess(orgId, "write");
  if (denied) return denied;

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
