import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import { runIncident, runTraffic, runVmsInspection } from "@/lib/scenarios";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ name: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;
  const { name } = await params;
  const url = new URL(request.url);
  const host = `${url.protocol}//${url.host}`;

  switch (name) {
    case "incident":
      return NextResponse.json(runIncident());
    case "vms-inspection":
      return NextResponse.json(runVmsInspection(host));
    case "traffic":
      return NextResponse.json(runTraffic());
    default:
      return NextResponse.json(
        {
          error: "Unknown scenario",
          detail: "Expected `incident`, `vms-inspection`, or `traffic`.",
        },
        { status: 400 },
      );
  }
}
