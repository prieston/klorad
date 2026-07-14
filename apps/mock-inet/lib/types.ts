/**
 * Shared types for the mock. Two important surfaces:
 *   1. iNET wire shapes — must match Parsons so the Klorad Mobility
 *      connector doesn't need to know it's talking to a mock.
 *   2. Demo domain types — Incidents, Worlds, Webhooks, StreamEvents.
 */
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Subsystems (mirrors `@klorad/connectors/inet-atms`)
// ─────────────────────────────────────────────────────────────

export const SUBSYSTEMS = [
  "cctv",
  "dms",
  "aid",
  "vms",
  "vsls",
  "radar",
] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];

export function isSubsystem(value: string): value is Subsystem {
  return (SUBSYSTEMS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────
// Device (Parsons-compatible)
//
// One shape covers every subsystem; extras are nullable. The Klorad
// connector reads only the base fields (id, subsystem, name, type,
// lat/lng, road/chainage, direction), so subsystem-specific extras
// pass through as opaque JSON.
// ─────────────────────────────────────────────────────────────

export interface Device {
  /** Parsons ships both fields — they're always equal. */
  deviceId: string;
  externalId: string;

  subsystem: Subsystem;
  /** Human-readable — Parsons often leaves this null. */
  name: string | null;
  /** Free-text type (e.g. `PTZ`, `Overhead`, `VMS`, `TYPE E1`). */
  type: string | null;
  /** Optional Parsons sub-classification. */
  subtype: string | null;

  direction: "WEST" | "EAST" | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  /** Numeric mileMarker on Parsons live (e.g. `0.0`); we serialise the
   *  workbook's `15+ 522` chainage back as a number when parseable, or
   *  keep the string in `chainage` (a Parsons-safe passthrough). */
  mileMarker: number | null;
  chainage: string | null;
  area: string | null;
  mounting: string | null;
  relativeLocation: string | null;

  latitude: number;
  longitude: number;
  /** Only present for radar-family devices. */
  bearing: number | null;

  routeId: number | null;
  agency: string;
  active: boolean;

  // CCTV / AID media hints
  hlsInd: boolean | null;
  hlsUri: string | null;
  dashUri: string | null;
  cameraIpAddr: string | null;
  url: string | null;
  controlType: "not specified" | "status" | "status and command" | null;

  // DMS / VMS / VSLS
  signType: number | null;
  pixelWidth: number | null;
  pixelHeight: number | null;
  /** Inline snapshot for DMS/VMS/VSLS list responses. Other subsystems
   *  (cctv/aid/radar) get status generated live at request time by
   *  `currentStatus()` — see `lib/devices.ts`. Typed loosely because
   *  the shape differs per subsystem; the connector accepts any
   *  passthrough. */
  status: Record<string, unknown> | null;

  // VSLS
  lane: string | null;
  groupIndex: number | null;
}

export interface DmsStatus {
  signId: string;
  connectable: boolean;
  shortStatus: number;
  controlMode: "photocell" | "manual" | "off";
  timestamp: number;
  message: string;
  beacon: boolean;
  brightnessLevel: RangedLevel;
  photocellLevel: RangedLevel;
  lightOutput: RangedLevel;
}

export interface RangedLevel {
  min: number;
  max: number;
  current: number;
}

// ─────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────

export const INCIDENT_STATUSES = [
  "posted",
  "acknowledged",
  "en_route",
  "on_scene",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  deviceId: string | null;
  postedAt: string;
  history: {
    status: IncidentStatus;
    at: string;
    note: string | null;
  }[];
}

export const IncidentCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  deviceId: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
});
export type IncidentCreate = z.infer<typeof IncidentCreateSchema>;

export const IncidentPatchSchema = z.object({
  status: z.enum(INCIDENT_STATUSES),
  note: z.string().nullish(),
});
export type IncidentPatch = z.infer<typeof IncidentPatchSchema>;

// ─────────────────────────────────────────────────────────────
// Worlds (scoped device sets, per Scenario 2)
// ─────────────────────────────────────────────────────────────

export const WorldFilterSchema = z.object({
  types: z.array(z.enum(SUBSYSTEMS)).optional(),
  direction: z.enum(["WEST", "EAST"]).optional(),
  area: z.array(z.string()).optional(),
  ids: z.array(z.string()).optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type WorldFilter = z.infer<typeof WorldFilterSchema>;

export interface World {
  id: string;
  slug: string;
  name: string;
  filter: WorldFilter;
  installUrl: string;
  createdAt: string;
}

export const WorldCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  filter: WorldFilterSchema,
});
export type WorldCreate = z.infer<typeof WorldCreateSchema>;

// ─────────────────────────────────────────────────────────────
// VDS sample (Scenario 3)
// ─────────────────────────────────────────────────────────────

export interface VdsSample {
  deviceId: string;
  timestamp: string;
  volume: number;
  speed: number;
  occupancy: number;
  perLane?: {
    lane: number;
    volume: number;
    speed: number;
    occupancy: number;
  }[];
}

// ─────────────────────────────────────────────────────────────
// Real-time stream / webhooks
// ─────────────────────────────────────────────────────────────

export const STREAM_EVENT_TYPES = [
  "device.status_changed",
  "incident.posted",
  "incident.status_changed",
  "vds.tick",
] as const;
export type StreamEventType = (typeof STREAM_EVENT_TYPES)[number];

export type StreamEvent =
  | { type: "device.status_changed"; at: string; payload: Device }
  | { type: "incident.posted"; at: string; payload: Incident }
  | { type: "incident.status_changed"; at: string; payload: Incident }
  | { type: "vds.tick"; at: string; payload: VdsSample };

export const WebhookCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(STREAM_EVENT_TYPES)).min(1),
  secret: z.string().min(8).optional(),
});
export type WebhookCreate = z.infer<typeof WebhookCreateSchema>;

export interface Webhook {
  id: string;
  url: string;
  events: StreamEventType[];
  secret: string;
  active: boolean;
  createdAt: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
}
