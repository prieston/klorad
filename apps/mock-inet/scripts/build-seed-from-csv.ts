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
  // Workbook is VMS-native (Greek regional naming). Emit rows tagged
  // as `dms` — Parsons' name for the same physical device — since the
  // Mobility picker treats DMS as canonical and VMS as a hidden
  // alias. Device codes get rewritten `W-VMS-…` → `W-DMS-…` at row
  // construction so the labels line up.
  { file: "vms.csv", subsystem: "dms" },
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
  const rawCode = pick(raw, "code", "device", "id");
  if (!rawCode) return null;
  // Rename `W-VMS-15.01` → `W-DMS-15.01` when the row lands under the
  // DMS subsystem so the device label ("DMS W-DMS-…") reads
  // consistently — otherwise it would be "DMS W-VMS-…", a leaky
  // reminder that our workbook is VMS-native.
  // The workbook has direction/pole prefixes on every code
  // (`W-`, `WR-`, `WF-`, `E-`, `ER-`, `EF-`), so match the `-VMS-`
  // segment rather than a fixed leading string.
  const code = subsystem === "dms" ? rawCode.replace(/-VMS-/, "-DMS-") : rawCode;

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
  if (subsystem === "cctv") {
    base.hlsInd = true;
    base.hlsUri = CCTV_DEMO_HLS;
    base.controlType = "status and command";
  }
  if (subsystem === "aid") {
    // AID cameras carry a distinct demo loop so the drawer visibly
    // differs from a PTZ feed at the same chainage. Overridden by the
    // AID backfill pass further down (which also picks the demo).
    base.hlsInd = true;
    base.hlsUri = AID_DEMO_HLS;
    base.controlType = "status and command";
  }
  if (subsystem === "dms") {
    base.signType = 1;
    base.pixelWidth = 84;
    base.pixelHeight = 7;
    base.status = makeDmsStatus(code);
  }
  if (subsystem === "vsls") {
    base.signType = 2;
    base.pixelWidth = 24;
    base.pixelHeight = 24;
    base.lane = pick(raw, "relative location") || null;
    base.groupIndex = parseNumber(pick(raw, "grouping")) ?? null;
    base.status = makeVslsStatus(code);
  }

  return base;
}

// Real road-traffic footage from Wikimedia Commons (VP8/VP9 WebM,
// CC-BY-SA / public domain). Movie clips (Tears of Steel, Sintel)
// looked wrong on a traffic-camera panel — an operator glances at
// the drawer and expects to see a road. The drawer's <video>
// element plays WebM natively in Chrome/Edge/Firefox; Safari
// requires H.264 MP4 and will fall back to the placeholder — an
// acceptable tradeoff for the current demo target.
const CCTV_DEMO_HLS =
  "https://upload.wikimedia.org/wikipedia/commons/6/68/Avtocesta.webm";
const AID_DEMO_HLS =
  "https://upload.wikimedia.org/wikipedia/commons/8/80/Verkehr_auf_Autobahn_A4_bei_Bautzen_%281%29.webm";

function primaryRoadFor(subsystem: Subsystem): string {
  switch (subsystem) {
    case "dms":
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
    case "dms":
      return "DMS";
    case "vsls":
      return "VSLS";
    case "radar":
      return "RADAR";
    case "vms":
      // Not emitted by any FILES entry after the DMS rename — kept
      // to satisfy the exhaustive Subsystem union.
      return "VMS";
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

/** Rotating DMS messages, keyed off a hash of the device id so each
 *  sign in the map shows different text and the demo doesn't read as
 *  "one identical message repeated 35 times". */
const DMS_MESSAGES = [
  "[pb]TRAFFIC AHEAD[nl]REDUCE SPEED",
  "[pb]INCIDENT[nl]LANE 2 CLOSED",
  "[pb]NO INCIDENTS[nl]DRIVE SAFE",
  "[pb]ROADWORK[nl]KM 15 TO 17",
  "[pb]WET ROAD[nl]KEEP DISTANCE",
  "[pb]DELAYS[nl]EXPECT 5 MIN",
] as const;

function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function makeDmsStatus(id: string) {
  const message = DMS_MESSAGES[idHash(id) % DMS_MESSAGES.length]!;
  return {
    signId: id,
    connectable: true,
    shortStatus: 0,
    controlMode: "photocell" as const,
    timestamp: Date.now(),
    message,
    beacon: false,
    brightnessLevel: { min: 0, max: 100, current: 75 },
    photocellLevel: { min: 0, max: 100, current: 50 },
    lightOutput: { min: 0, max: 255, current: 200 },
    maxLinesPerPage: 3,
    maxCharsPerLine: 16,
  };
}

/** VSLS panels show a lane speed limit — a single 2-digit number
 *  rather than free text. Cycle 60 / 80 / 100 by id hash so the
 *  operator drawer visibly differs between lanes. */
function makeVslsStatus(id: string) {
  const limits = [60, 80, 100] as const;
  const limit = limits[idHash(id) % limits.length]!;
  return {
    signId: id,
    connectable: true,
    shortStatus: 0,
    controlMode: "manual" as const,
    timestamp: Date.now(),
    message: `[pb]${limit}`,
    beacon: false,
    brightnessLevel: { min: 0, max: 100, current: 90 },
    photocellLevel: { min: 0, max: 100, current: 55 },
    lightOutput: { min: 0, max: 255, current: 220 },
    maxLinesPerPage: 1,
    maxCharsPerLine: 3,
    speedLimit: limit,
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
        // AID cameras stream video alongside their event feed —
        // point at a distinct demo loop so the drawer's video panel
        // renders and the operator can see it's a different camera
        // to the PTZ at the same chainage.
        hlsInd: true,
        hlsUri: AID_DEMO_HLS,
        dashUri: null,
        cameraIpAddr: null,
        url: null,
        controlType: "status and command",
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

  const jittered = deoverlapCoLocated(output);
  console.log(`[seed] spread ${jittered} co-located devices in small rings`);

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`[seed] wrote ${output.length} devices → ${OUT_PATH}`);
  console.log("[seed] totals:", perSubsystem);
}

/** Icons stacked on identical coordinates were unclickable — the top
 *  one absorbs every click and the ones under it can't be selected.
 *  Group devices by ~1-metre-rounded coord and spread each cluster
 *  in a small ring so every device gets its own icon slot.
 *
 *  Deterministic: within a cluster we sort by externalId and hand
 *  out angles by index, so re-seeding produces the same layout.
 *  Ring radius scales with cluster size — a 2-device pair stays
 *  tight (~10 m centre-to-centre), a 10-device pile-up gets a wider
 *  ring so the icons don't overlap edge-to-edge at typical zoom. */
function deoverlapCoLocated(devices: Device[]): number {
  const groups = new Map<string, Device[]>();
  for (const d of devices) {
    const key = `${d.latitude.toFixed(5)},${d.longitude.toFixed(5)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(d);
    else groups.set(key, [d]);
  }
  const METRES_PER_DEGREE_LAT = 111_320;
  let moved = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.externalId.localeCompare(b.externalId));
    const centerLat = group[0]!.latitude;
    const centerLng = group[0]!.longitude;
    const metresPerDegreeLng =
      METRES_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
    // 8 m minimum + 1 m per additional device — keeps 2-device pairs
    // tight and prevents 10+ pile-ups from overlapping around the
    // ring circumference.
    const radiusMetres = 8 + Math.max(0, group.length - 2);
    for (let i = 0; i < group.length; i += 1) {
      const angle = (2 * Math.PI * i) / group.length;
      const dLat = (radiusMetres * Math.sin(angle)) / METRES_PER_DEGREE_LAT;
      const dLng = (radiusMetres * Math.cos(angle)) / metresPerDegreeLng;
      group[i]!.latitude = centerLat + dLat;
      group[i]!.longitude = centerLng + dLng;
      moved += 1;
    }
  }
  return moved;
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
