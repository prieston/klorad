import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { getWorld } from "@/lib/worlds";
import { filterDevices } from "@/lib/devices";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const { id } = await params;
  const world = getWorld(id);
  if (!world) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(filterDevices(world.filter));
}
