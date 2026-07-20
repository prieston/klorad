/**
 * POST /api/webhooks/inet-atms/[sourceId]
 *   Inbound webhook consumer for the mock (and any real iNET tenant
 *   that follows the same envelope). Verifies the HMAC signature on
 *   the request body against the source's stored `webhookSecret`,
 *   parses the event, walks the project's enabled alert rules, and
 *   opens a `MobilityAlert` per matching rule (which also dispatches
 *   pushes via `openAlertAndDispatch`).
 *
 * Every terminal exit path records a `WebhookReceipt` on the
 * `webhook-audit` ring buffer so the Alert Rules "Recent webhook
 * activity" panel can surface what actually happened — invalid
 * signature, no matches, no matching device row, etc. Debugging a
 * silent "no alerts" then becomes a UI query instead of tail-ing
 * server logs.
 *
 * Auth: HMAC only. No session, no CSRF token, no rate-limit yet —
 * upstream is the mock, which controls the secret.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  evaluateRules,
  explainRules,
  type StoredRule,
  type UpstreamEvent,
} from "@/lib/mobility/alert-rules";
import { openAlertAndDispatch } from "@/lib/mobility/alert-dispatch";
import {
  previewPayload,
  record as recordReceipt,
} from "@/lib/mobility/webhook-audit";

export const runtime = "nodejs";

type Params = Promise<{ sourceId: string }>;

const SIGNATURE_HEADER = "x-psmdt-signature";

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const source = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: { id: true, projectId: true, webhookSecret: true, enabled: true },
  });
  if (!source) {
    recordReceipt(null, {
      sourceId,
      outcome: "unknown_source",
      eventType: null,
      payloadPreview: null,
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: "source id not found",
    });
    return NextResponse.json({ error: "Unknown source" }, { status: 404 });
  }
  if (!source.webhookSecret) {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "not_registered",
      eventType: null,
      payloadPreview: null,
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: "source has no webhookSecret — click Register webhook on the source",
    });
    return NextResponse.json(
      { error: "Webhook not registered for this source" },
      { status: 400 },
    );
  }
  if (!source.enabled) {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "source_disabled",
      eventType: null,
      payloadPreview: null,
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: "source is disabled — events are ignored until re-enabled",
    });
    // Return 200 with a note so the upstream doesn't retry and
    // eventually deactivate the webhook while the source is paused.
    return NextResponse.json({ ok: true, ignored: "source disabled" });
  }

  // Read the raw body once — needed both for HMAC verify and for
  // JSON parse.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get(SIGNATURE_HEADER);
  if (!verifySignature(rawBody, source.webhookSecret, signatureHeader)) {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "bad_signature",
      eventType: null,
      payloadPreview: previewPayload({ rawBody: rawBody.slice(0, 200) }),
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: signatureHeader
        ? "signature header present but did not verify — secret out of sync?"
        : "no signature header on request",
    });
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let event: UpstreamEvent;
  try {
    event = JSON.parse(rawBody) as UpstreamEvent;
  } catch {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "invalid_json",
      eventType: null,
      payloadPreview: previewPayload({ rawBody: rawBody.slice(0, 200) }),
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: "body was not valid JSON",
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "malformed_event",
      eventType: null,
      payloadPreview: previewPayload(event),
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: "event JSON missing `type` string field",
    });
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  const rules = await prisma.mobilityAlertRule.findMany({
    where: {
      projectId: source.projectId,
      // Include disabled rules so the audit panel can show that a
      // rule was intentionally muted rather than mismatched.
      OR: [{ sourceId: null }, { sourceId: source.id }],
    },
    select: {
      id: true,
      name: true,
      enabled: true,
      kind: true,
      config: true,
      targets: true,
    },
  });

  if (rules.length === 0) {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "no_rules",
      eventType: event.type,
      payloadPreview: previewPayload(event.payload),
      rules: [],
      alertsCreated: 0,
      pushesDelivered: 0,
      note: "no rules configured for this project (try Seed demo rules)",
    });
    return NextResponse.json({ ok: true, matched: 0, note: "no rules" });
  }

  const explanations = explainRules(event, rules as StoredRule[]);
  const matches = evaluateRules(event, rules as StoredRule[]);

  if (matches.length === 0) {
    recordReceipt(source.projectId, {
      sourceId,
      outcome: "no_matches",
      eventType: event.type,
      payloadPreview: previewPayload(event.payload),
      rules: explanations.map((e) => ({
        ruleId: e.ruleId,
        ruleName: e.ruleName,
        matched: e.matched,
        reason: e.reason,
      })),
      alertsCreated: 0,
      pushesDelivered: 0,
      note: null,
    });
    return NextResponse.json({ ok: true, matched: 0 });
  }

  // Resolve device ids in one query so we don't roundtrip per match.
  // `externalId` is the *unpacked* form the mock ships; our stored
  // `externalDeviceId` matches that shape (see sync.ts line 254).
  const externalIds = Array.from(
    new Set(matches.map((m) => m.externalId).filter((s): s is string => !!s)),
  );
  const devices = externalIds.length
    ? await prisma.mobilityDevice.findMany({
        where: {
          projectId: source.projectId,
          sourceId: source.id,
          externalDeviceId: { in: externalIds },
        },
        select: { id: true, externalDeviceId: true },
      })
    : [];
  const deviceIdByExternal = new Map(
    devices.map((d) => [d.externalDeviceId, d.id]),
  );

  let inserted = 0;
  let pushedCount = 0;
  const dispatchNotes: string[] = [];
  for (const match of matches) {
    if (!match.externalId) {
      dispatchNotes.push(`${match.ruleName}: matched but payload had no externalId/deviceId`);
      continue;
    }
    const deviceId = deviceIdByExternal.get(match.externalId);
    if (!deviceId) {
      dispatchNotes.push(
        `${match.ruleName}: matched externalId="${match.externalId}" but no MobilityDevice row for this source (needs a sync)`,
      );
      continue;
    }
    const result = await openAlertAndDispatch({
      projectId: source.projectId,
      deviceId,
      ruleId: match.ruleId,
      ruleName: match.ruleName,
      kind: match.alertKind,
      message: match.message,
      targetWorldIds: match.targetWorldIds,
    });
    inserted += 1;
    pushedCount += result.pushed.reduce((a, p) => a + p.delivered, 0);
  }

  recordReceipt(source.projectId, {
    sourceId,
    outcome: "processed",
    eventType: event.type,
    payloadPreview: previewPayload(event.payload),
    rules: explanations.map((e) => ({
      ruleId: e.ruleId,
      ruleName: e.ruleName,
      matched: e.matched,
      reason: e.reason,
    })),
    alertsCreated: inserted,
    pushesDelivered: pushedCount,
    note: dispatchNotes.length > 0 ? dispatchNotes.join(" · ") : null,
  });

  return NextResponse.json({
    ok: true,
    matched: matches.length,
    inserted,
    pushed: pushedCount,
  });
}

/** Compare the incoming signature to a re-computed one using
 *  constant-time equality so we don't leak byte positions through a
 *  timing side channel. Header format matches the mock's sender:
 *  `sha256=<hex>`. */
function verifySignature(
  body: string,
  secret: string,
  header: string | null,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const supplied = header.startsWith("sha256=") ? header.slice(7) : header;
  if (supplied.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(supplied, "hex"),
    );
  } catch {
    return false;
  }
}
