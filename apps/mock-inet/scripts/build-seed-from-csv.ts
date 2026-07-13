/**
 * Converts the CSVs in `seed/csv/*.csv` into `seed/devices.json`.
 * Dropped rows: anything missing a valid lat/lon. The mock refuses to
 * serve devices we can't place on a map — cleaner than showing (0,0).
 *
 * Column layout in the source workbook is inconsistent across sheets
 * so we key by header name rather than positional index.
 *
 * Run: `pnpm seed`
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Device, Subsystem } from "../lib/types";

const CSV_DIR = join(process.cwd(), "seed", "csv");
const OUT_PATH = join(process.cwd(), "seed", "devices.json");

interface FileSpec {
  file: string;
  subsystem: Subsystem;
}

const FILES: FileSpec[] = [
  { file: "aid.csv", subsystem: "aid" },
  { file: "cctv.csv", subsystem: "cctv" },
  { file: "vms.csv", subsystem: "vms" },
  { file: "vsls.csv", subsystem: "vsls" },
  { file: "radar-main.csv", subsystem: "radar" },
  { file: "radar-ramp.csv", subsystem: "radar" },
  { file: "radar-rm.csv", subsystem: "radar" },
];

interface Row {
  raw: Record<string, string>;
}

/** Minimal CSV parser — handles quoted fields with embedded commas
 *  but not quoted newlines. Sufficient for the equipment workbook.
 *
 *  De-duplicates repeated header names because the PTZ sheet has two
 *  columns literally titled `Latitude` (typo for the Longitude
 *  column). Without this, both cells collide on the same key and one
 *  gets discarded. The known Latitude/Latitude case gets special-
 *  cased to Latitude/Longitude; everything else gets a numeric
 *  suffix. */
function parseCsv(input: string): { headers: string[]; rows: Row[] } {
  const lines = input.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = disambiguateHeaders(splitLine(lines[0] || ""));
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i]);
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      raw[headers[j]] = (cells[j] ?? "").trim();
    }
    rows.push({ raw });
  }
  return { headers, rows };
}

function disambiguateHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((original) => {
    const trimmed = original.trim();
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, 1);
      return trimmed;
    }
    const nth = seen.get(key)! + 1;
    seen.set(key, nth);
    // Latitude/Latitude → Latitude/Longitude: the equipment workbook's
    // PTZ + a handful of other sheets ship this typo.
    if (key === "latitude" && nth === 2) return "Longitude";
    return `${trimmed}_${nth}`;
  });
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Case-tolerant, whitespace-tolerant header lookup. */
function pick(raw: Record<string, string>, ...keys: string[]): string {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    normalized[k.trim().toLowerCase()] = v;
  }
  for (const k of keys) {
    const hit = normalized[k.trim().toLowerCase()];
    if (hit != null && hit.length > 0) return hit;
  }
  return "";
}

function parseNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d.\-+eE]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse the `XX+ YYY` chainage into a bare metre count, or leave the
 *  original string alongside if the shape doesn't match. */
function parseChainage(s: string): { mileMarker: number | null; chainage: string | null } {
  if (!s) return { mileMarker: null, chainage: null };
  const chainage = s.trim();
  const m = /(\d+)\s*\+\s*([\d.]+)/.exec(chainage);
  if (!m) return { mileMarker: null, chainage };
  const km = Number(m[1]);
  const metres = Number(m[2]);
  if (!Number.isFinite(km) || !Number.isFinite(metres)) {
    return { mileMarker: null, chainage };
  }
  return { mileMarker: km + metres / 1000, chainage };
}

function rowToDevice(subsystem: Subsystem, raw: Record<string, string>): Device | null {
  const code = pick(raw, "code", "device", "id");
  if (!code) return null;

  const rawLat = parseNumber(pick(raw, "latitude", "lat"));
  const rawLng = parseNumber(pick(raw, "longitude", "long", "lng"));
  if (rawLat === null || rawLng === null) return null;
  // Sanity — the workbook has a handful of transposed / zero cells.
  if (Math.abs(rawLat) < 1 && Math.abs(rawLng) < 1) return null;

  const chainage = parseChainage(pick(raw, "location"));
  const dirRaw = pick(raw, "direction").toUpperCase();
  const direction: Device["direction"] =
    dirRaw === "WEST" || dirRaw === "EAST" ? dirRaw : null;
  const bearing = parseNumber(pick(raw, "rotation", "bearing"));

  const base: Device = {
    deviceId: code,
    externalId: code,
    subsystem,
    name: `${defaultLabel(subsystem)} ${code}`,
    type: pick(raw, "type", "its equipment") || null,
    subtype: pick(raw, "type") || null,
    direction,
    primaryRoad: primaryRoadFor(subsystem),
    crossRoad: null,
    mileMarker: chainage.mileMarker,
    chainage: chainage.chainage,
    area: pick(raw, "geographical area", "area") || null,
    mounting: rawFirstColumn(raw) || null,
    relativeLocation: pick(raw, "relative location") || null,
    latitude: rawLat,
    longitude: rawLng,
    bearing,
    routeId: null,
    agency: "DEMO",
    active: true,
    hlsInd: null,
    hlsUri: null,
    dashUri: null,
    cameraIpAddr: null,
    url: null,
    controlType: null,
    signType: null,
    pixelWidth: null,
    pixelHeight: null,
    status: null,
    lane: null,
    groupIndex: null,
  };

  // Subsystem-specific enrichments.
  if (subsystem === "cctv" || subsystem === "aid") {
    // No live stream in the mock — set a demo HLS pointing at a
    // sample loop the map can render as a placeholder. The client
    // just needs the field to exist for the "Live" tab to render.
    base.hlsInd = true;
    base.hlsUri = "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8";
    base.controlType = "status and command";
  }
  if (subsystem === "vms") {
    base.signType = 1;
    base.pixelWidth = 84;
    base.pixelHeight = 7;
    base.status = makeDefaultStatus(code);
  }
  if (subsystem === "vsls") {
    base.signType = 2;
    base.pixelWidth = 24;
    base.pixelHeight = 24;
    base.lane = pick(raw, "relative location") || null;
    base.groupIndex = parseNumber(pick(raw, "grouping")) ?? null;
    base.status = makeDefaultStatus(code);
  }

  return base;
}

function primaryRoadFor(subsystem: Subsystem): string {
  switch (subsystem) {
    case "vms":
    case "vsls":
      return "Flyover";
    case "radar":
      return "Flyover · Ring";
    case "cctv":
    case "aid":
      return "Flyover · Corridor";
    default:
      return "Flyover";
  }
}

function defaultLabel(subsystem: Subsystem): string {
  switch (subsystem) {
    case "cctv":
      return "PTZ";
    case "aid":
      return "AID";
    case "vms":
      return "VMS";
    case "vsls":
      return "VSLS";
    case "radar":
      return "RADAR";
    case "dms":
      return "DMS";
  }
}

/** The workbook's mounting column has no header — first cell is
 *  usually blank. Return whatever's in that unnamed column. */
function rawFirstColumn(raw: Record<string, string>): string {
  for (const [k, v] of Object.entries(raw)) {
    if (k.trim() === "" || k.trim().toLowerCase() === "a/a") continue;
    if (
      !/latitude|longitude|code|equipment|direction|location|geographical|type|rotation|position|grouping|inside/i.test(
        k,
      )
    ) {
      if (v) return v;
    }
  }
  return "";
}

function makeDefaultStatus(id: string) {
  return {
    signId: id,
    connectable: true,
    shortStatus: 0,
    controlMode: "photocell" as const,
    timestamp: Date.now(),
    message: "[pb]FLYOVER[nl]Drive safe",
    beacon: false,
    brightnessLevel: { min: 0, max: 100, current: 75 },
    photocellLevel: { min: 0, max: 100, current: 50 },
    lightOutput: { min: 0, max: 255, current: 200 },
  };
}

function main() {
  const filesOnDisk = new Set(readdirSync(CSV_DIR));
  const output: Device[] = [];
  const perSubsystem: Record<string, { kept: number; dropped: number }> = {};

  for (const spec of FILES) {
    if (!filesOnDisk.has(spec.file)) {
      console.warn(`[seed] skipping missing ${spec.file}`);
      continue;
    }
    const csv = readFileSync(join(CSV_DIR, spec.file), "utf8");
    const { rows } = parseCsv(csv);
    let kept = 0;
    let dropped = 0;
    for (const row of rows) {
      const device = rowToDevice(spec.subsystem, row.raw);
      if (device) {
        output.push(device);
        kept += 1;
      } else {
        dropped += 1;
      }
    }
    const bucket = (perSubsystem[spec.subsystem] ||= { kept: 0, dropped: 0 });
    bucket.kept += kept;
    bucket.dropped += dropped;
    console.log(`[seed] ${spec.file}: kept ${kept}, dropped ${dropped}`);
  }

  // AID has no lat/lon column in the source workbook, but AID cameras
  // are typically co-mounted on the same pole as a PTZ (per the "ON
  // PTZ POLE" flag on many AID rows). Reprocess the AID sheet and
  // borrow coordinates from the nearest CCTV row in the same
  // direction by chainage — good enough for the demo map.
  if (filesOnDisk.has("aid.csv")) {
    const csv = readFileSync(join(CSV_DIR, "aid.csv"), "utf8");
    const { rows } = parseCsv(csv);
    const cctvAnchors = output.filter((d) => d.subsystem === "cctv");
    let backfilled = 0;
    let unresolved = 0;
    for (const row of rows) {
      const code = pick(row.raw, "code", "device", "id");
      if (!code) continue;
      const chainage = parseChainage(pick(row.raw, "location"));
      const dirRaw = pick(row.raw, "direction").toUpperCase();
      const direction: Device["direction"] =
        dirRaw === "WEST" || dirRaw === "EAST" ? dirRaw : null;
      const anchor = nearestCctvAnchor(cctvAnchors, direction, chainage.mileMarker);
      if (!anchor) {
        unresolved += 1;
        continue;
      }
      const device: Device = {
        deviceId: code,
        externalId: code,
        subsystem: "aid",
        name: `AID ${code}`,
        type: pick(row.raw, "type", "its equipment") || "AID CAMERA",
        subtype: null,
        direction,
        primaryRoad: primaryRoadFor("aid"),
        crossRoad: null,
        mileMarker: chainage.mileMarker,
        chainage: chainage.chainage,
        area: pick(row.raw, "geographical area", "area") || null,
        mounting: rawFirstColumn(row.raw) || null,
        relativeLocation: pick(row.raw, "relative location") || null,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        bearing: anchor.bearing,
        routeId: null,
        agency: "DEMO",
        active: true,
        // AID's primary output is an event stream — no video feed in
        // the mock. Leave media hints null.
        hlsInd: null,
        hlsUri: null,
        dashUri: null,
        cameraIpAddr: null,
        url: null,
        controlType: "status",
        signType: null,
        pixelWidth: null,
        pixelHeight: null,
        status: null,
        lane: null,
        groupIndex: null,
      };
      output.push(device);
      backfilled += 1;
    }
    perSubsystem.aid = { kept: backfilled, dropped: unresolved };
    console.log(
      `[seed] aid.csv (backfill): kept ${backfilled}, unresolved ${unresolved}`,
    );
  }

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`[seed] wrote ${output.length} devices → ${OUT_PATH}`);
  console.log("[seed] totals:", perSubsystem);
}

/** Nearest CCTV anchor by chainage delta, subject to same direction.
 *  Returns null when either the direction or chainage is unknown or
 *  no CCTV rows fit — the AID row is then dropped. */
function nearestCctvAnchor(
  anchors: Device[],
  direction: Device["direction"],
  chainageKm: number | null,
): { latitude: number; longitude: number; bearing: number | null } | null {
  if (!direction || chainageKm === null) return null;
  let best: Device | null = null;
  let bestDelta = Infinity;
  for (const a of anchors) {
    if (a.direction !== direction) continue;
    if (a.mileMarker === null) continue;
    const delta = Math.abs(a.mileMarker - chainageKm);
    if (delta < bestDelta) {
      best = a;
      bestDelta = delta;
    }
  }
  // Cap at ~500 metres — beyond that we're guessing.
  if (!best || bestDelta > 0.5) return null;
  return {
    latitude: best.latitude,
    longitude: best.longitude,
    bearing: best.bearing,
  };
}

main();
