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

const THESS = { lat: 40.6401, lng: 22.9444 };

/** Spread synthetic devices in a small ring around the city centre
 *  so the map clusters look natural. */
function jitter(seed: number, kind: "lat" | "lng"): number {
  const base = kind === "lat" ? THESS.lat : THESS.lng;
  const r = (Math.sin(seed * 9301 + 49297) * 233280) % 1;
  return base + r * 0.04;
}

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
      url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      streamType: "hls",
    },
  },
  ...Array.from({ length: 4 }, (_, i) => ({
    deviceId: packId("cctv", `99${i + 1}`),
    externalId: `99${i + 1}`,
    subsystem: "cctv" as const,
    type: "Overhead",
    lat: jitter(i + 1, "lat"),
    lng: jitter(i + 1, "lng"),
    mileMarker: null,
    primaryRoad: ["Tsimiski", "Mitropoleos", "Egnatia Odos", "Nikis"][i] ?? null,
    crossRoad: null,
    direction: null,
    routeId: null,
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
  ...Array.from({ length: 2 }, (_, i) => ({
    deviceId: packId("dms", `89${i + 1}`),
    externalId: `89${i + 1}`,
    subsystem: "dms" as const,
    type: "Overhead",
    lat: jitter(i + 10, "lat"),
    lng: jitter(i + 10, "lng"),
    mileMarker: null,
    primaryRoad: ["Egnatia Odos", "PATHE"][i] ?? null,
    crossRoad: null,
    direction: null,
    routeId: null,
    agency: "DEMO",
    name: `Demo-DMS-${i + 1}`,
    media: null,
  })),
];

export const FIXTURE_DEVICES: Record<InetSubsystem, InetDevice[]> = {
  cctv: FIXTURE_CCTV_DEVICES,
  dms: FIXTURE_DMS_DEVICES,
};

/** Seed status keyed by `deviceId`. Most devices online; one in
 *  each subsystem alarmed so the dashboard's alert feed has
 *  something to surface in fixture mode. */
export const FIXTURE_STATUSES: Record<string, InetStatus> = {
  [packId("cctv", "24432")]: {
    deviceId: packId("cctv", "24432"),
    online: true,
    alarm: null,
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: {
      connectable: true,
      viewable: true,
      controllable: true,
      ptz: { pan: 12, tilt: -4, zoom: 1.2 },
    },
  },
  [packId("cctv", "991")]: {
    deviceId: packId("cctv", "991"),
    online: false,
    alarm: "Camera offline",
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: { connectable: false, viewable: false },
  },
  [packId("dms", "21413")]: {
    deviceId: packId("dms", "21413"),
    online: true,
    alarm: null,
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: {
      message: "[pb0][jp3][cf9]THESSALONIKI[nl]TEST[nl]MESSAGE",
      brightness: 70,
      photocell: 4200,
      maxLinesPerPage: 3,
      maxCharsPerLine: 16,
    },
  },
  [packId("dms", "891")]: {
    deviceId: packId("dms", "891"),
    online: false,
    alarm: "Sign unreachable",
    observedAt: new Date("2026-06-08T08:00:00Z").toISOString(),
    raw: {},
  },
};
