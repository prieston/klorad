/**
 * Incident store — in-memory. Every state transition emits an
 * `incident.status_changed` event. New incidents emit `incident.posted`.
 *
 * Legal transitions:
 *   posted → acknowledged → en_route → on_scene → resolved
 *
 * Any earlier→later jump is allowed; going backwards is rejected with
 * a 409 so the demo timeline stays consistent.
 */
import { randomUUID } from "node:crypto";
import type {
  Incident,
  IncidentCreate,
  IncidentPatch,
  IncidentStatus,
} from "./types";
import { INCIDENT_STATUSES } from "./types";
import { deviceByExternalId, allDevices } from "./devices";
import { publish } from "./events";

const store: Map<string, Incident> = new Map();

const ORDER: Record<IncidentStatus, number> = {
  posted: 0,
  acknowledged: 1,
  en_route: 2,
  on_scene: 3,
  resolved: 4,
};

export function listIncidents(): Incident[] {
  return Array.from(store.values()).sort((a, b) =>
    a.postedAt < b.postedAt ? 1 : -1,
  );
}

export function getIncident(id: string): Incident | undefined {
  return store.get(id);
}

export function createIncident(input: IncidentCreate): Incident {
  const now = new Date().toISOString();
  const anchor = input.deviceId ? findAnchor(input.deviceId) : null;
  const lat = input.latitude ?? anchor?.latitude ?? 0;
  const lng = input.longitude ?? anchor?.longitude ?? 0;
  const incident: Incident = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? "",
    status: "posted",
    latitude: lat,
    longitude: lng,
    deviceId: input.deviceId ?? null,
    postedAt: now,
    history: [{ status: "posted", at: now, note: null }],
  };
  store.set(incident.id, incident);
  publish({ type: "incident.posted", at: now, payload: incident });
  return incident;
}

export function patchIncident(
  id: string,
  input: IncidentPatch,
): Incident | { error: "not_found" } | { error: "invalid_transition" } {
  const incident = store.get(id);
  if (!incident) return { error: "not_found" };
  if (ORDER[input.status] < ORDER[incident.status]) {
    return { error: "invalid_transition" };
  }
  if (input.status === incident.status) return incident;

  const now = new Date().toISOString();
  incident.status = input.status;
  incident.history.push({
    status: input.status,
    at: now,
    note: input.note ?? null,
  });
  publish({ type: "incident.status_changed", at: now, payload: incident });
  return incident;
}

/** Pick a device to anchor an incident against — an explicit id if
 *  provided, otherwise a random AID/PTZ so scripted scenarios have a
 *  camera-adjacent location to render. */
export function pickIncidentAnchor(preferred?: string) {
  if (preferred) {
    const explicit = findAnchor(preferred);
    if (explicit) return explicit;
  }
  const candidates = allDevices().filter(
    (d) => d.subsystem === "aid" || d.subsystem === "cctv",
  );
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function findAnchor(externalId: string) {
  for (const subsystem of ["aid", "cctv", "vms", "vsls", "radar"] as const) {
    const found = deviceByExternalId(subsystem, externalId);
    if (found) return found;
  }
  return null;
}

/** Next legal status, or `null` if already resolved. Used by the
 *  scripted incident-lifecycle runner. */
export function nextStatus(current: IncidentStatus): IncidentStatus | null {
  const idx = INCIDENT_STATUSES.indexOf(current);
  if (idx < 0 || idx === INCIDENT_STATUSES.length - 1) return null;
  return INCIDENT_STATUSES[idx + 1];
}
