import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, requireBasicAuth } from "@/lib/auth";
import {
  resetAll,
  runDmsAlarm,
  runIncident,
  runIncidentCascade,
  runRadarSpike,
  runTraffic,
  runVmsInspection,
} from "@/lib/scenarios";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ name: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  // Demo triggers are the whole point of the /api/demo surface —
  // the mock's own homepage should be able to fire them with a click.
  // External callers (curl, CI, remote demos) still need Basic auth.
  if (!isSameOriginRequest(request)) {
    const denied = requireBasicAuth(request);
    if (denied) return denied;
  }
  const { name } = await params;
  const url = new URL(request.url);
  const host = `${url.protocol}//${url.host}`;
  // Optional `deviceId` query for the targeted scenarios; when omitted
  // the runner picks a random device of the right subsystem.
  const deviceId = url.searchParams.get("deviceId") ?? undefined;

  try {
    switch (name) {
      case "incident":
        return NextResponse.json(runIncident());
      case "vms-inspection":
        return NextResponse.json(runVmsInspection(host));
      case "traffic":
        return NextResponse.json(runTraffic());
      case "radar-spike":
        return NextResponse.json(runRadarSpike(deviceId));
      case "dms-alarm":
        return NextResponse.json(runDmsAlarm(deviceId));
      case "incident-cascade":
        return NextResponse.json(runIncidentCascade());
      case "reset":
        return NextResponse.json(resetAll());
      default:
        return NextResponse.json(
          {
            error: "Unknown scenario",
            detail:
              "Expected `incident`, `vms-inspection`, `traffic`, `radar-spike`, `dms-alarm`, `incident-cascade`, or `reset`.",
          },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scenario failed" },
      { status: 500 },
    );
  }
}
