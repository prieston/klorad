import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { createIncident, listIncidents } from "@/lib/incidents";
import { IncidentCreateSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  return NextResponse.json(listIncidents());
}

export async function POST(request: NextRequest) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const parsed = IncidentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const incident = createIncident(parsed.data);
  return NextResponse.json(incident, { status: 201 });
}
