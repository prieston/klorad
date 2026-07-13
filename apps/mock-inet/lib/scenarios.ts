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
import { startTicker, stopTicker, triggerSlowdown } from "./vds";
import type { IncidentStatus } from "./types";

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
