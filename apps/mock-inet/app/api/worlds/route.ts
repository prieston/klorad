import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { createWorld, listWorlds } from "@/lib/worlds";
import { WorldCreateSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  return NextResponse.json(listWorlds());
}

export async function POST(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const parsed = WorldCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const url = new URL(request.url);
  const host = `${url.protocol}//${url.host}`;
  const world = createWorld(parsed.data, host);
  return NextResponse.json(world, { status: 201 });
}
