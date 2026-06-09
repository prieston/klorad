/**
 * Types + Zod schemas for the Parsons iNET ATMS adapter.
 *
 * The connector targets the public REST surface documented at
 * https://demobe.parsonsinet.com (and equivalent on-prem deployments).
 * Each subsystem (cctv, dms, etc.) lives at its own path:
 *
 *   GET /atms/{subsystem}-rest/rest/{subsystem}             — list
 *   GET /atms/{subsystem}-rest/rest/{subsystem}/{id}        — one
 *   GET /atms/{subsystem}-rest/rest/{subsystem}/{id}/status — status
 *   GET /atms/{subsystem}-rest/rest/{subsystem}/{id}/imageList (DMS)
 *
 * The raw API shapes have plenty of legacy / placeholder fields
 * (state, county, etc. that demo deployments leave empty); we only
 * narrow the fields that drive rendering and Zod-validate the rest as
 * pass-through to keep `unknown` data shapes from poisoning the
 * adapter.
 */
import { z } from "zod";

/** Subsystems the adapter understands today. Add new ones to this
 *  union and they automatically appear in the per-tenant multi-select
 *  in the Mobility settings UI. */
export const INET_SUBSYSTEMS = ["cctv", "dms"] as const;
export type InetSubsystem = (typeof INET_SUBSYSTEMS)[number];

/** Per-tenant config persisted with credentials encrypted at rest via
 *  @klorad/secrets. The HTTP `password` field is the only sensitive
 *  one; everything else is plaintext. */
export const InetAtmsConfigSchema = z.object({
  /** Base URL of the ATMS host, no trailing slash. */
  host: z.string().url().refine((u) => !u.endsWith("/"), {
    message: "host must not end with '/'",
  }),
  /** HTTP Basic auth. v1 only supports basic; bearer / api-key
   *  branches added in a later phase. */
  username: z.string().min(1),
  password: z.string().min(1),
  /** Subsystems the tenant has enabled. Empty array = no devices
   *  surfaced; the UI surfaces a clear "enable a subsystem" hint. */
  subsystems: z.array(z.enum(INET_SUBSYSTEMS)).default([]),
  /** Fixture mode serves seeded Thessaloniki demo data instead of
   *  hitting the live host. Flipping to "live" requires only valid
   *  credentials, no code change. */
  mode: z.enum(["fixture", "live"]).default("fixture"),
  /** Optional friendly label shown alongside the host in the UI. */
  displayName: z.string().max(80).optional(),
  /** Poll interval for the sync runner (seconds). Defaults to 5
   *  minutes — short enough for status freshness, long enough that
   *  a tenant with 10 sources doesn't hammer the API. */
  pollIntervalSeconds: z.number().int().min(30).max(3600).default(300),
});

export type InetAtmsConfig = z.infer<typeof InetAtmsConfigSchema>;

/** Normalised device shape — what `listEntities` / `getEntity` yield.
 *  Subsystem-tagged so the operator dashboard can render the right
 *  drawer (camera vs. sign) off one collection. */
export interface InetDevice {
  /** Stable id, encoded as `${subsystem}:${externalId}` so it survives
   *  the connector framework's single-id contract for multi-subsystem
   *  sources. */
  deviceId: string;
  /** Native id from the upstream system (e.g. `24432`). */
  externalId: string;
  subsystem: InetSubsystem;
  /** Free-text device type from the source (e.g. "PTZ", "Overhead"). */
  type: string | null;
  /** Latitude / longitude in WGS84. **Render strictly off these** —
   *  state, county, etc. in the raw API are placeholders in demo
   *  data and must stay display-only. */
  lat: number | null;
  lng: number | null;
  /** Locator fields surfaced verbatim, no normalisation. */
  mileMarker: string | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  routeId: string | null;
  agency: string | null;
  /** Friendly name from the source — falls back to `${subsystem} ${externalId}`. */
  name: string;
  /** Subsystem-specific media hint. For CCTV: the stream URL
   *  (.m3u8 / .mp4). For DMS: optional snapshot path or `null` —
   *  the rendered NTCIP face is the primary view. */
  media: InetMedia | null;
}

export type InetMedia =
  | {
      kind: "cctv-stream";
      /** Stream URL — HLS preferred, MP4 fallback. Always served
       *  through the app-side media proxy in production to bypass
       *  CORS / mixed-content; the connector returns the raw URL. */
      url: string;
      /** Discriminator for the player. */
      streamType: "hls" | "mp4";
    }
  | {
      kind: "dms-image-list";
      /** Path the snapshot endpoint serves. */
      path: string;
    };

/** Status shape — small + uniform across subsystems. Per-subsystem
 *  details that don't fit go in `raw` so the dashboard can still
 *  render adapter-specific drawers without a schema bump. */
export interface InetStatus {
  deviceId: string;
  /** Connectable / viewable / controllable booleans collapsed to
   *  one boolean for the "online" indicator. */
  online: boolean;
  /** Free-text alarm description; null when no alarm is active. */
  alarm: string | null;
  /** Server timestamp the status was generated. */
  observedAt: string;
  /** Subsystem-specific extras. DMS puts `message` + `brightness`
   *  here; CCTV puts PTZ position when available. */
  raw: Record<string, unknown>;
}

/** Raw shape of one CCTV device from the API. Loose schema — we
 *  narrow what we render and pass the rest through. */
export const RawCctvDeviceSchema = z
  .object({
    deviceId: z.union([z.string(), z.number()]).transform(String),
    deviceName: z.string().nullish(),
    description: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    mileMarker: z.string().nullish(),
    primaryRoad: z.string().nullish(),
    crossRoad: z.string().nullish(),
    direction: z.string().nullish(),
    routeId: z.string().nullish(),
    agency: z.string().nullish(),
    cameraType: z.string().nullish(),
    cameraIpAddr: z.string().nullish(),
    streamingUrl: z.string().nullish(),
  })
  .passthrough();

export type RawCctvDevice = z.infer<typeof RawCctvDeviceSchema>;

/** Raw shape of one DMS device. */
export const RawDmsDeviceSchema = z
  .object({
    deviceId: z.union([z.string(), z.number()]).transform(String),
    deviceName: z.string().nullish(),
    description: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    mileMarker: z.string().nullish(),
    primaryRoad: z.string().nullish(),
    crossRoad: z.string().nullish(),
    direction: z.string().nullish(),
    routeId: z.string().nullish(),
    agency: z.string().nullish(),
    signType: z.string().nullish(),
    maxLinesPerPage: z.number().int().nullish(),
    maxCharsPerLine: z.number().int().nullish(),
  })
  .passthrough();

export type RawDmsDevice = z.infer<typeof RawDmsDeviceSchema>;

/** Raw status shape. Same skeleton for both subsystems; subsystem-
 *  specific fields are tolerated via passthrough. */
export const RawStatusSchema = z
  .object({
    deviceId: z.union([z.string(), z.number()]).transform(String),
    connectable: z.boolean().nullish(),
    viewable: z.boolean().nullish(),
    controllable: z.boolean().nullish(),
    alarmStatus: z.string().nullish(),
    timestamp: z.string().nullish(),
    message: z.string().nullish(),
    brightness: z.number().nullish(),
    photocell: z.number().nullish(),
  })
  .passthrough();

export type RawStatus = z.infer<typeof RawStatusSchema>;
