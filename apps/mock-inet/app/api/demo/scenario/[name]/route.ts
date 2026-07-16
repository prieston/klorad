import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import {
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
  const denied = requireBasicAuth(request);
  if (denied) return denied;
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
      default:
        return NextResponse.json(
          {
            error: "Unknown scenario",
            detail:
              "Expected `incident`, `vms-inspection`, `traffic`, `radar-spike`, `dms-alarm`, or `incident-cascade`.",
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
