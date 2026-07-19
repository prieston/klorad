/**
 * Scripted scenario runners — one function per PSMdt-iNET pitch
 * scenario. Each is idempotent per name: calling `run("incident")`
 * twice resets the running incident instead of stacking a second one.
 */
import {
  createIncident,
  getIncident,
  nextStatus,
  patchIncident,
  pickIncidentAnchor,
} from "./incidents";
import { createWorld } from "./worlds";
import { startTicker, stopTicker, tickerRunning, triggerSlowdown } from "./vds";
import type { Device, IncidentStatus } from "./types";
import { allDevices, devicesBySubsystem } from "./devices";
import { setOverride, activeOverrides, clearOverride } from "./overrides";
import { publish } from "./events";

interface RunningIncident {
  id: string;
  timer: NodeJS.Timeout;
}
let runningIncident: RunningIncident | null = null;
let runningTraffic = false;

/**
 * Scenario 1 — Response to Incident.
 * Creates a new incident anchored to a random AID+PTZ cluster and
 * walks it through the status pipeline on a 6-second cadence:
 * posted → acknowledged → en_route → on_scene → resolved.
 */
export function runIncident(): { name: "incident"; status: "started" | "reset"; incidentId: string } {
  const wasRunning = !!runningIncident;
  if (runningIncident) {
    clearInterval(runningIncident.timer);
    runningIncident = null;
  }

  const anchor = pickIncidentAnchor();
  const incident = createIncident({
    title: "Vehicle stopped in the left lane",
    description:
      "Automated detection from the AID camera. Requesting patrol response.",
    deviceId: anchor?.externalId ?? null,
  });

  const timer = setInterval(() => {
    const next = nextStatus(
      (runningIncident && incidentStatus(incident.id)) || "posted",
    );
    if (!next) {
      if (runningIncident) {
        clearInterval(runningIncident.timer);
        runningIncident = null;
      }
      return;
    }
    patchIncident(incident.id, { status: next, note: `auto-advanced to ${next}` });
  }, 6000);

  runningIncident = { id: incident.id, timer };
  return {
    name: "incident",
    status: wasRunning ? "reset" : "started",
    incidentId: incident.id,
  };
}

/**
 * Scenario 2 — O&M VMS Inspection.
 * Creates a world scoped to Western Ring-Road VMS signs and returns
 * the install URL. Not time-based; there's nothing to tick.
 */
export function runVmsInspection(host: string): {
  name: "vms-inspection";
  status: "started";
  installUrl: string;
} {
  const world = createWorld(
    {
      name: "Western Ring · VMS",
      slug: "western-ring-vms",
      filter: { types: ["vms"], direction: "WEST" },
    },
    host,
  );
  return {
    name: "vms-inspection",
    status: "started",
    installUrl: world.installUrl,
  };
}

/**
 * Scenario 3 — Active Traffic Management.
 * Kicks off the VDS traffic loop and stages a scripted slowdown on a
 * random radar 15 seconds in. Idempotent — calling twice resets both.
 */
export function runTraffic(): { name: "traffic"; status: "started" | "reset" } {
  const wasRunning = runningTraffic;
  if (runningTraffic) {
    stopTicker();
  }
  startTicker();
  setTimeout(() => triggerSlowdown(), 15_000);
  runningTraffic = true;
  return {
    name: "traffic",
    status: wasRunning ? "reset" : "started",
  };
}

// The incidents store is authoritative — read the current status
// straight from it instead of re-tracking here.
function incidentStatus(id: string): IncidentStatus | null {
  return getIncident(id)?.status ?? null;
}

/** Default demo window for status overrides. Long enough for the
 *  Mobility drawer's 15-second polling to see the "hot" values on
 *  multiple polls; short enough that the demo self-cleans. */
const OVERRIDE_MS = 3 * 60 * 1000;

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

function publishDeviceStatusChanged(device: Device): void {
  publish({
    type: "device.status_changed",
    at: new Date().toISOString(),
    // We forward the *device record* verbatim (matches the wire shape
    // downstream connectors expect); the consumer can call /status to
    // read the fresh values including our override.
    payload: device,
  });
}

/**
 * Scenario 4 — Radar occupancy spike.
 * Picks a radar (specific `deviceId` or random) and forces occupancy
 * to `0.85` with speed dropped to `18` for 3 minutes. Fires two
 * `device.status_changed` events: one at spike, one when the
 * override expires (scheduled via `setTimeout`, best-effort).
 *
 * This is what an "alert me when occupancy > 70%" rule (Arc C PR3)
 * fires on — the mock provides the trigger data on demand instead
 * of waiting for real rush-hour traffic.
 */
export function runRadarSpike(deviceId?: string): {
  name: "radar-spike";
  status: "started";
  deviceId: string;
} {
  const pool = devicesBySubsystem("radar");
  const device = deviceId
    ? pool.find((d) => d.externalId === deviceId) ?? pickRandom(pool)
    : pickRandom(pool);
  if (!device) throw new Error("No radar devices seeded");
  setOverride(
    device.externalId,
    { occupancy: 0.85, speed: 18, volume: 105 },
    OVERRIDE_MS,
    "Scenario: radar occupancy spike",
  );
  publishDeviceStatusChanged(device);
  setTimeout(() => publishDeviceStatusChanged(device), OVERRIDE_MS + 200);
  return { name: "radar-spike", status: "started", deviceId: device.externalId };
}

/**
 * Scenario 5 — DMS alarm.
 * Picks a DMS sign and flips its `shortStatus` to a non-zero value +
 * `connectable` false for 3 minutes. This makes it show up as
 * `offline` / `alarmed` — the two `MobilityAlert.kind` values —
 * without any actual outage. Feeds "alert me when a sign faults"
 * rules downstream.
 */
export function runDmsAlarm(deviceId?: string): {
  name: "dms-alarm";
  status: "started";
  deviceId: string;
} {
  const pool = devicesBySubsystem("dms");
  const device = deviceId
    ? pool.find((d) => d.externalId === deviceId) ?? pickRandom(pool)
    : pickRandom(pool);
  if (!device) throw new Error("No DMS devices seeded");
  setOverride(
    device.externalId,
    {
      connectable: false,
      shortStatus: 0x0004,
      controlMode: "manual",
      message: "[pb]SIGN FAULT[nl]TECH DISPATCHED",
    },
    OVERRIDE_MS,
    "Scenario: DMS alarm",
  );
  publishDeviceStatusChanged(device);
  setTimeout(() => publishDeviceStatusChanged(device), OVERRIDE_MS + 200);
  return { name: "dms-alarm", status: "started", deviceId: device.externalId };
}

/**
 * Scenario 6 — Incident cascade.
 * Combines the existing incident runner with a co-located radar
 * spike + a DMS alarm to reproduce a realistic "something happened
 * on the highway" moment: incident posted → nearby radar starts
 * showing a jam → a downstream sign flips to a fault-adjacent
 * message asking traffic to slow. Rule editors can wire distinct
 * push targets to each of the three underlying events.
 */
export function runIncidentCascade(): {
  name: "incident-cascade";
  status: "started";
  incidentId: string;
  radarDeviceId: string | null;
  dmsDeviceId: string | null;
} {
  const incident = runIncident();
  const radar = pickRandom(devicesBySubsystem("radar"));
  const dms = pickRandom(devicesBySubsystem("dms"));
  let radarDeviceId: string | null = null;
  let dmsDeviceId: string | null = null;
  if (radar) {
    const spike = runRadarSpike(radar.externalId);
    radarDeviceId = spike.deviceId;
  }
  // Stagger the DMS alarm 4s in so the demo watcher sees the events
  // arrive as a sequence, not all at once.
  if (dms) {
    setTimeout(() => runDmsAlarm(dms.externalId), 4_000);
    dmsDeviceId = dms.externalId;
  }
  return {
    name: "incident-cascade",
    status: "started",
    incidentId: incident.incidentId,
    radarDeviceId,
    dmsDeviceId,
  };
}

/**
 * Reset everything back to nominal. The counterpart to the trigger
 * scenarios — clears every 3-minute override, stops the traffic
 * ticker, cancels the running incident, and publishes a fresh
 * `device.status_changed` for each device that had an override so
 * subscribers (webhooks, mobility alert engine) see the "restored"
 * state without waiting for the 3-minute expiry.
 *
 * This is the "make the demo look normal again" button — critical
 * for running the pitch back-to-back without a 3-minute cool-down.
 */
export function resetAll(): {
  name: "reset";
  status: "reset";
  cleared: {
    incident: boolean;
    traffic: boolean;
    overrides: number;
  };
} {
  const hadIncident = runningIncident !== null;
  if (runningIncident) {
    clearInterval(runningIncident.timer);
    runningIncident = null;
  }

  const hadTraffic = runningTraffic;
  if (runningTraffic) {
    stopTicker();
    runningTraffic = false;
  }

  // Snapshot active overrides BEFORE clearing so we can re-publish
  // the "back to normal" event for each affected device. Order
  // matters — clear then publish (so subscribers that re-read
  // /status see the clean value).
  const active = activeOverrides();
  for (const row of active) {
    clearOverride(row.externalId);
  }
  // `activeOverrides()` only carries the externalId; look the device
  // up in the flat pool since overrides are subsystem-agnostic.
  const byExternalId = new Map<string, Device>();
  for (const d of allDevices()) byExternalId.set(d.externalId, d);
  for (const row of active) {
    const device = byExternalId.get(row.externalId);
    if (device) publishDeviceStatusChanged(device);
  }

  return {
    name: "reset",
    status: "reset",
    cleared: {
      incident: hadIncident,
      traffic: hadTraffic,
      overrides: active.length,
    },
  };
}

export interface ScenarioStatus {
  incident: {
    running: boolean;
    id: string | null;
  };
  traffic: {
    running: boolean;
  };
  overrides: Array<{
    externalId: string;
    reason: string;
    expiresAt: number;
    remainingMs: number;
  }>;
}

/**
 * Snapshot of what's currently "hot" — powers the demo panel's
 * active-state badges. Reads authoritative state from each module
 * rather than tracking it here twice.
 */
export function getScenarioStatus(): ScenarioStatus {
  const now = Date.now();
  return {
    incident: {
      running: runningIncident !== null,
      id: runningIncident?.id ?? null,
    },
    traffic: {
      running: tickerRunning(),
    },
    overrides: activeOverrides().map((o) => ({
      externalId: o.externalId,
      reason: o.reason,
      expiresAt: o.expiresAt,
      remainingMs: Math.max(0, o.expiresAt - now),
    })),
  };
}
