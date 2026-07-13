import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { getIncident, patchIncident } from "@/lib/incidents";
import { IncidentPatchSchema } from "@/lib/types";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const { id } = await params;
  const incident = getIncident(id);
  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(incident);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = IncidentPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const result = patchIncident(id, parsed.data);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "not_found" ? 404 : 409 },
    );
  }
  return NextResponse.json(result);
}
