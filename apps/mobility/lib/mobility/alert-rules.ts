/**
 * Alert-rule evaluator. Pure functions — no DB, no side effects; the
 * webhook consumer calls `evaluateRules(event, rules)` and passes the
 * resulting alerts to the insert path. Splitting keeps the evaluator
 * testable and lets Arc C PR3's rule editor preview matches against
 * current state without a webhook round-trip.
 */
import { z } from "zod";
import type { MobilityAlertKind } from "@prisma/client";

// ─── Rule config schemas ────────────────────────────────────────────

/** Numeric comparison ops the threshold evaluator supports. */
const ThresholdOp = z.enum(["gt", "gte", "lt", "lte", "eq"]);
export type ThresholdOp = z.infer<typeof ThresholdOp>;

export const ThresholdConfig = z.object({
  subsystem: z.string().min(1),
  field: z.string().min(1),
  op: ThresholdOp,
  value: z.number(),
});
export type ThresholdConfig = z.infer<typeof ThresholdConfig>;

/** Upstream event types the mock emits — mirrored from
 *  `apps/mock-inet/lib/types.ts`. Kept as a plain string enum here
 *  so this file doesn't cross the workspace boundary. */
const UpstreamEventType = z.enum([
  "device.status_changed",
  "incident.posted",
  "incident.status_changed",
  "vds.tick",
]);

export const EventConfig = z.object({
  eventType: UpstreamEventType,
});
export type EventConfig = z.infer<typeof EventConfig>;

/** Combined discriminator — used at the API layer to validate the
 *  `{kind, config}` pair coming from the rule editor form. */
export const RuleBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("threshold"), config: ThresholdConfig }),
  z.object({ kind: z.literal("event"), config: EventConfig }),
]);
export type RuleBody = z.infer<typeof RuleBody>;

export const RuleTargets = z.object({
  /** Push notification targets — the world subscribers Arc C PR3
   *  fans out to when this rule fires. Empty = alert row only,
   *  no push. */
  worldIds: z.array(z.string()).default([]),
});
export type RuleTargets = z.infer<typeof RuleTargets>;

// ─── Upstream event shapes (mirrored, not imported) ─────────────────

export interface DeviceStatusEvent {
  type: "device.status_changed";
  at: string;
  payload: {
    subsystem: string;
    externalId?: string;
    deviceId?: string;
    // Anything else the mock ships through — we only read `status.*`
    // when the rule is a threshold; the rest passes through opaquely.
    status?: Record<string, unknown> | null;
    [k: string]: unknown;
  };
}

export interface IncidentEvent {
  type: "incident.posted" | "incident.status_changed";
  at: string;
  payload: {
    id: string;
    title?: string;
    status?: string;
    deviceId?: string | null;
    [k: string]: unknown;
  };
}

export type UpstreamEvent =
  | DeviceStatusEvent
  | IncidentEvent
  | { type: "vds.tick"; at: string; payload: unknown };

// ─── Rule shape as read from Prisma ─────────────────────────────────

export interface StoredRule {
  id: string;
  name: string;
  enabled: boolean;
  kind: "threshold" | "event";
  config: unknown;
  targets: unknown;
}

// ─── Evaluator ──────────────────────────────────────────────────────

/** What the webhook consumer produces per fired rule — enough for the
 *  DB insert + the (Arc C PR3) push dispatch. Kept flat + serialisable
 *  so nothing else in the pipeline needs to look up rule details. */
export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  externalId: string | null;
  subsystem: string | null;
  alertKind: MobilityAlertKind;
  message: string;
  targetWorldIds: string[];
}

/** Walk `rules` against a single upstream `event`. Returns one match
 *  per rule that fires. A malformed rule config drops the rule for
 *  this evaluation (not an outage) rather than throwing. */
export function evaluateRules(
  event: UpstreamEvent,
  rules: StoredRule[],
): RuleMatch[] {
  const out: RuleMatch[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.kind === "threshold" && event.type === "device.status_changed") {
      const parsedConfig = ThresholdConfig.safeParse(rule.config);
      if (!parsedConfig.success) continue;
      const match = matchThreshold(event, parsedConfig.data);
      if (!match) continue;
      out.push(buildMatch(rule, match.externalId, match.subsystem, match.msg));
    } else if (rule.kind === "event") {
      const parsedConfig = EventConfig.safeParse(rule.config);
      if (!parsedConfig.success) continue;
      if (parsedConfig.data.eventType !== event.type) continue;
      const eventMatch = matchEvent(event);
      out.push(
        buildMatch(rule, eventMatch.externalId, eventMatch.subsystem, eventMatch.msg),
      );
    }
  }
  return out;
}

function matchThreshold(
  event: DeviceStatusEvent,
  cfg: ThresholdConfig,
): {
  externalId: string | null;
  subsystem: string;
  msg: string;
} | null {
  if ((event.payload.subsystem ?? "") !== cfg.subsystem) return null;
  const status = event.payload.status;
  if (!status || typeof status !== "object") return null;
  const raw = (status as Record<string, unknown>)[cfg.field];
  if (typeof raw !== "number") return null;
  if (!compare(raw, cfg.op, cfg.value)) return null;
  return {
    externalId:
      typeof event.payload.externalId === "string"
        ? event.payload.externalId
        : typeof event.payload.deviceId === "string"
          ? event.payload.deviceId
          : null,
    subsystem: cfg.subsystem,
    msg: `${cfg.subsystem}.${cfg.field} ${cfg.op} ${cfg.value} (observed ${raw})`,
  };
}

function matchEvent(event: UpstreamEvent): {
  externalId: string | null;
  subsystem: string | null;
  msg: string;
} {
  if (event.type === "device.status_changed") {
    const p = event.payload;
    return {
      externalId:
        typeof p.externalId === "string"
          ? p.externalId
          : typeof p.deviceId === "string"
            ? p.deviceId
            : null,
      subsystem: typeof p.subsystem === "string" ? p.subsystem : null,
      msg: `Device ${p.externalId ?? p.deviceId ?? "?"} status changed`,
    };
  }
  if (event.type === "incident.posted" || event.type === "incident.status_changed") {
    return {
      externalId: (event.payload.deviceId as string) ?? null,
      subsystem: null,
      msg:
        event.type === "incident.posted"
          ? `Incident posted: ${event.payload.title ?? event.payload.id}`
          : `Incident ${event.payload.id} → ${event.payload.status ?? "?"}`,
    };
  }
  return { externalId: null, subsystem: null, msg: `${event.type} received` };
}

function buildMatch(
  rule: StoredRule,
  externalId: string | null,
  subsystem: string | null,
  msg: string,
): RuleMatch {
  const targets = RuleTargets.safeParse(rule.targets);
  const worldIds = targets.success ? targets.data.worldIds : [];
  // For now every rule maps to `alarmed`. When we grow a distinct
  // "device stayed offline for N minutes" evaluator (v2), it will
  // emit `offline` instead — but the current evaluator sees a single
  // status snapshot, not a duration, so `alarmed` is the honest
  // classification.
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    externalId,
    subsystem,
    alertKind: "alarmed",
    message: msg,
    targetWorldIds: worldIds,
  };
}

function compare(observed: number, op: ThresholdOp, target: number): boolean {
  switch (op) {
    case "gt":
      return observed > target;
    case "gte":
      return observed >= target;
    case "lt":
      return observed < target;
    case "lte":
      return observed <= target;
    case "eq":
      return observed === target;
  }
}
