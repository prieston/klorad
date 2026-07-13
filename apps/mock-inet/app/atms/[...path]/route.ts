/**
 * Layer 1 — iNET drop-in.
 *
 * Matches every Parsons ATMS surface the Klorad `@klorad/connectors/inet-atms`
 * connector talks to:
 *
 *   GET /atms/{subsystem}-rest/rest/{subsystem}/
 *   GET /atms/{subsystem}-rest/rest/{subsystem}/{externalId}
 *   GET /atms/{subsystem}-rest/rest/{subsystem}/{externalId}/status
 *
 * Next 15 doesn't support dynamic segments in the middle of a path
 * segment (`[subsystem]-rest` isn't a valid route directory name), so
 * we catch every `/atms/...` path with a single handler and parse the
 * shape ourselves.
 *
 * The connector expects bare JSON arrays for list responses (no
 * envelope) and either an object or a single-element array for
 * status. We serve the object form; the connector tolerates both.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/auth";
import {
  deviceByExternalId,
  pageDevices,
  parseSubsystem,
} from "@/lib/devices";
import type { Subsystem } from "@/lib/types";

export const runtime = "nodejs";

interface PathParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, { params }: PathParams) {
  const denied = requireBasicAuth(request);
  if (denied) return denied;

  const { path } = await params;
  if (path.length < 3) return notFound();

  const [firstSeg, restSeg, subsystemSeg, externalId, action] = path;
  // Validate the `{subsystem}-rest/rest/{subsystem}` prefix.
  const prefixMatch = /^([a-z]+)-rest$/.exec(firstSeg);
  if (!prefixMatch || restSeg !== "rest" || prefixMatch[1] !== subsystemSeg) {
    return notFound();
  }
  const subsystem = parseSubsystem(subsystemSeg);
  if (!subsystem) return notFound();

  // ── /atms/{s}-rest/rest/{s}/  → list
  if (!externalId) return listResponse(subsystem, request);
  // ── /atms/{s}-rest/rest/{s}/{id}  → single
  if (!action) return singleResponse(subsystem, externalId);
  // ── /atms/{s}-rest/rest/{s}/{id}/status  → status
  if (action === "status") return statusResponse(subsystem, externalId);
  return notFound();
}

function listResponse(subsystem: Subsystem, request: NextRequest) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const startId = url.searchParams.get("start_id") ?? undefined;
  const query = url.searchParams.get("query") ?? undefined;
  const lat = url.searchParams.has("lat")
    ? Number(url.searchParams.get("lat"))
    : undefined;
  const lng = url.searchParams.has("lng")
    ? Number(url.searchParams.get("lng"))
    : undefined;
  const items = pageDevices(subsystem, {
    limit,
    startId,
    query,
    lat,
    lng,
  });
  return NextResponse.json(items);
}

function singleResponse(subsystem: Subsystem, externalId: string) {
  const device = deviceByExternalId(subsystem, externalId);
  if (!device) return notFound();
  return NextResponse.json(device);
}

function statusResponse(subsystem: Subsystem, externalId: string) {
  // Only DMS-family devices carry a distinct status shape. Parsons
  // tolerates the /status suffix on any device but returns null or an
  // empty object for cctv/aid/radar — mirror that.
  const device = deviceByExternalId(subsystem, externalId);
  if (!device) return notFound();
  return NextResponse.json(device.status ?? {});
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
