/**
 * Thessaloniki fixture data for the iNET adapter.
 *
 * Two real device shapes from the brief (CCTV 24432 + DMS 21413)
 * plus a handful of synthetic neighbours so clustering + the map
 * look populated. Used when `InetAtmsConfig.mode === "fixture"` so
 * the entire dashboard works before credentials arrive.
 *
 * Every fixture device is **labelled as demo** via `agency = "DEMO"`
 * — the dashboard surfaces this so an operator never confuses
 * seeded rows with live ATMS data.
 */
import type {
  InetDevice,
  InetStatus,
  InetSubsystem,
} from "./types.js";

/** Pack a subsystem + external id into the connector's `deviceId`
 *  contract. Mirrors the parsing in `adapter.ts`. */
function packId(subsystem: InetSubsystem, externalId: string): string {
  return `${subsystem}:${externalId}`;
}

/**
 * Synthetic device positions — hand-picked along the actual
 * Thessaloniki road network instead of randomly jittered (the
 * previous Math.sin approach used the same seed for lat and lng,
 * so every neighbour ended up on a single NE-SW diagonal line).
 *
 * Roads:
 *   • Egnatia Odos (A2) — east-west motorway, north of the city,
 *     passes Eleftherio Kordelio → Stavroupoli → Polichni → Pylaia
 *     → exits eastward toward the Halkidiki turn-off.
 *   • PATHE (A1) — connects Athens to Thessaloniki on the coastal
 *     approach via Mikra airport + Pylaia junction.
 *   • Tsimiski / Egnatia (in-city) — central arterials in the
 *     historic centre.
 */
const CCTV_NEIGHBOURS: Array<{ lat: number; lng: number; road: string }> = [
  { lat: 40.6818, lng: 22.8956, road: "Egnatia Odos · Eleftherio Kordelio" },
  { lat: 40.6720, lng: 22.9358, road: "Egnatia Odos · Stavroupoli" },
  { lat: 40.6651, lng: 22.9709, road: "Egnatia Odos · Pylaia junction" },
  { lat: 40.6505, lng: 23.0105, road: "Egnatia Odos · Thermi exit" },
];

const DMS_NEIGHBOURS: Array<{ lat: number; lng: number; road: string }> = [
  { lat: 40.6014, lng: 22.9994, road: "PATHE · Mikra approach" },
  { lat: 40.6585, lng: 22.9533, road: "Polichni junction" },
];

export const FIXTURE_CCTV_DEVICES: InetDevice[] = [
  {
    deviceId: packId("cctv", "24432"),
    externalId: "24432",
    subsystem: "cctv",
    type: "PTZ",
    lat: 40.69556,
    lng: 22.94972,
    mileMarker: null,
    primaryRoad: "Egnatia Odos",
    crossRoad: null,
    direction: "EB",
    routeId: null,
    agency: "DEMO",
    name: "Thessaloniki-CCTV01",
    media: {
      kind: "cctv-stream",
      // Same NYSDOT camera the live Parsons demo proxies on
      // CCTV 24432 → faithful demo, faithful video.
      url: "https://s9.nysdot.skyvdn.com:443/rtplive/R8_214/playlist.m3u8",
      streamType: "hls",
    },
  },
  ...CCTV_NEIGHBOURS.map((n, i) => ({
    deviceId: packId("cctv", `99${i + 1}`),
    externalId: `99${i + 1}`,
    subsystem: "cctv" as const,
    type: "Overhead",
    lat: n.lat,
    lng: n.lng,
    mileMarker: null,
    primaryRoad: n.road,
    crossRoad: null,
    direction: i % 2 === 0 ? "EB" : "WB",
    routeId: "A2",
    agency: "DEMO",
    name: `Demo-CCTV-${i + 1}`,
    media: null,
  })),
];

export const FIXTURE_DMS_DEVICES: InetDevice[] = [
  {
    deviceId: packId("dms", "21413"),
    externalId: "21413",
    subsystem: "dms",
    type: "Overhead",
    lat: 40.65463,
    lng: 22.96568,
    mileMarker: null,
    primaryRoad: "PATHE Motorway",
    crossRoad: null,
    direction: "SB",
    routeId: null,
    agency: "DEMO",
    name: "PATHE-DMS-01",
    media: null,
  },
  ...DMS_NEIGHBOURS.map((n, i) => ({
    deviceId: packId("dms", `89${i + 1}`),
    externalId: `89${i + 1}`,
    subsystem: "dms" as const,
    type: "Overhead",
    lat: n.lat,
    lng: n.lng,
    mileMarker: null,
    primaryRoad: n.road,
    crossRoad: null,
    direction: i === 0 ? "NB" : "SB",
    routeId: i === 0 ? "A1" : null,
    agency: "DEMO",
    name: `Demo-DMS-${i + 1}`,
    media: null,
  })),
];

export const FIXTURE_DEVICES: Record<InetSubsystem, InetDevice[]> = {
  cctv: FIXTURE_CCTV_DEVICES,
  dms: FIXTURE_DMS_DEVICES,
  // PSMdt-iNET demo subsystems have no in-package fixtures — a live
  // source pointed at the `psmdt-inet-mock` deployment carries the
  // real seeded inventory. Empty arrays keep the record total so
  // `FIXTURE_DEVICES[subsystem]` never throws on any enum value.
  aid: [],
  vms: [],
  vsls: [],
  radar: [],
};

/** Seed status keyed by `deviceId`. Shapes mirror the live Parsons
 *  iNET response (verified against the demo docs for DMS 21413), so
 *  the dashboard renders identical fields in fixture and live mode. */
export const FIXTURE_STATUSES: Record<string, InetStatus> = {
  [packId("cctv", "24432")]: {
    deviceId: packId("cctv", "24432"),
    online: true,
    alarm: null,
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: {
      connectable: true,
      ptz: { pan: 12, tilt: -4, zoom: 1.2 },
    },
  },
  [packId("cctv", "991")]: {
    deviceId: packId("cctv", "991"),
    online: false,
    alarm: "Camera offline",
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: { connectable: false },
  },
  [packId("dms", "21413")]: {
    deviceId: packId("dms", "21413"),
    online: true,
    alarm: null,
    observedAt: new Date(1776950067084).toISOString(),
    raw: {
      // Exact NTCIP MULTI the live Parsons demo returns for 21413,
      // including the on/off-time controls in `[pt30o0]`.
      message:
        "[pb0][jp3][pt30o0][jl3][cf9]THESSALONIKI[nl][jl3][cf9]TEST[nl][jl3][cf9]MESSAGE",
      source: 8,
      beacon: false,
      timestamp: 1776950067084,
      connectable: true,
      shortStatus: 0,
      controlMode: "photocell",
      manualLevel: 10,
      signId: 21413,
      // Nested level objects exactly as the live API returns them…
      photocellLevel: { min: 0, max: 20, current: 5 },
      brightnessLevel: { min: 0, max: 15, current: 10 },
      lightOutput: { min: 0, max: 65535, current: 1000 },
      graphic: false,
      // …plus the flattened conveniences the DMS face renderer reads
      // (`raw.brightness`, `raw.photocell`, sign-grid bounds).
      brightness: 10,
      photocell: 5,
      maxLinesPerPage: 3,
      maxCharsPerLine: 16,
    },
  },
  [packId("dms", "891")]: {
    deviceId: packId("dms", "891"),
    online: false,
    alarm: "Fault bits 0x10",
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: { connectable: false, shortStatus: 16 },
  },
};
