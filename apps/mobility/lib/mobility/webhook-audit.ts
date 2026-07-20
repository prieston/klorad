/**
 * In-memory ring buffer for the last N webhook receipts per project.
 * Powers the Alert Rules "Recent webhook activity" panel — the answer
 * to "I triggered a scenario but nothing happened, where did it go?".
 *
 * Every terminal step of `/api/webhooks/inet-atms/[sourceId]` calls
 * `record(...)` with an outcome so the operator can see, in real time:
 *
 *   - whether the webhook is even reaching mobility
 *   - whether the HMAC is valid (source registered + secret matches)
 *   - which rules matched vs which didn't and why
 *   - whether device rows exist for the matched externalId
 *   - whether alerts were opened + pushes delivered
 *
 * Vercel serverless caveat: this is process-local. A cold start
 * clears the buffer. That's acceptable for a live-debug session —
 * during the "trigger → observe" loop the operator is running the
 * mock + mobility calls land on the same warm instance. If we ever
 * need cross-instance history the receipts belong in a Prisma table
 * (or on the existing `MobilityWorldEvent` audit stream); for now
 * ephemeral is fine.
 */

export type WebhookOutcomeKind =
  | "unknown_source"
  | "not_registered"
  | "source_disabled"
  | "bad_signature"
  | "invalid_json"
  | "malformed_event"
  | "no_rules"
  | "no_matches"
  | "processed";

export interface RuleOutcome {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  /** Human-readable reason — either "matched: ..." or "no match: ...". */
  reason: string;
}

export interface WebhookReceipt {
  id: string;
  at: number;
  sourceId: string;
  outcome: WebhookOutcomeKind;
  eventType: string | null;
  /** Truncated JSON of the event payload (first 400 chars). Handy
   *  when a rule doesn't match to eyeball what actually arrived. */
  payloadPreview: string | null;
  rules: RuleOutcome[];
  alertsCreated: number;
  pushesDelivered: number;
  /** Short human note — the "why" for terminal outcomes that skipped
   *  processing (missing signature header, etc.). */
  note: string | null;
}

/** Buffer size per project. Fifty is enough for a full demo session
 *  (each scenario emits at most 2 events × 6 scenarios = 12) with
 *  slack for repeats. */
const CAP = 50;

const store = new Map<string, WebhookReceipt[]>();

export function record(
  projectId: string | null,
  receipt: Omit<WebhookReceipt, "id" | "at"> & {
    id?: string;
    at?: number;
  },
): void {
  // Unknown-source outcomes have no projectId — bucket them under a
  // sentinel key so we still surface them somewhere. In practice the
  // panel only queries per project, so these end up dropped, but they
  // stay in memory in case a future "system webhook feed" wants them.
  const key = projectId ?? "__no_project__";
  const ring = store.get(key) ?? [];
  ring.unshift({
    id: receipt.id ?? randomId(),
    at: receipt.at ?? Date.now(),
    sourceId: receipt.sourceId,
    outcome: receipt.outcome,
    eventType: receipt.eventType,
    payloadPreview: receipt.payloadPreview,
    rules: receipt.rules,
    alertsCreated: receipt.alertsCreated,
    pushesDelivered: receipt.pushesDelivered,
    note: receipt.note,
  });
  if (ring.length > CAP) ring.length = CAP;
  store.set(key, ring);
}

export function recentReceipts(projectId: string): WebhookReceipt[] {
  return store.get(projectId) ?? [];
}

/** Rounds trip an unknown value into a short preview string for the
 *  panel. Truncated so a massive VDS tick payload doesn't dominate
 *  the response. */
export function previewPayload(payload: unknown, max = 400): string {
  try {
    const s = JSON.stringify(payload);
    if (s.length <= max) return s;
    return s.slice(0, max) + "…";
  } catch {
    return "[unserializable]";
  }
}

function randomId(): string {
  // Enough uniqueness for a client list key. Not security-sensitive.
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}
