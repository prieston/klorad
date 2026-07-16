/**
 * POST /api/webhooks/inet-atms/[sourceId]
 *   Inbound webhook consumer for the mock (and any real iNET tenant
 *   that follows the same envelope). Verifies the HMAC signature on
 *   the request body against the source's stored `webhookSecret`,
 *   parses the event, walks the project's enabled alert rules, and
 *   opens a `MobilityAlert` per matching rule.
 *
 * The push fan-out to world subscribers is Arc C PR3 — this endpoint
 * only inserts the alert rows and returns the count. Once PR3 lands
 * the same insert path also dispatches pushes.
 *
 * Auth: HMAC only. No session, no CSRF token, no rate-limit yet —
 * upstream is the mock, which controls the secret.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateRules, type StoredRule, type UpstreamEvent } from "@/lib/mobility/alert-rules";

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
    return NextResponse.json({ error: "Unknown source" }, { status: 404 });
  }
  if (!source.webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not registered for this source" },
      { status: 400 },
    );
  }
  if (!source.enabled) {
    // Return 200 with a note so the upstream doesn't retry and
    // eventually deactivate the webhook while the source is paused.
    return NextResponse.json({ ok: true, ignored: "source disabled" });
  }

  // Read the raw body once — needed both for HMAC verify and for
  // JSON parse.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get(SIGNATURE_HEADER);
  if (!verifySignature(rawBody, source.webhookSecret, signatureHeader)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let event: UpstreamEvent;
  try {
    event = JSON.parse(rawBody) as UpstreamEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  const rules = await prisma.mobilityAlertRule.findMany({
    where: {
      projectId: source.projectId,
      enabled: true,
      // Rules scoped to a source only match webhooks from that source;
      // project-wide rules (sourceId = null) match every source.
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

  const matches = evaluateRules(event, rules as StoredRule[]);
  if (matches.length === 0) {
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
  for (const match of matches) {
    if (!match.externalId) continue;
    const deviceId = deviceIdByExternal.get(match.externalId);
    if (!deviceId) continue;
    await prisma.mobilityAlert.create({
      data: {
        projectId: source.projectId,
        deviceId,
        kind: match.alertKind,
        message: `[${match.ruleName}] ${match.message}`,
      },
    });
    inserted += 1;
    // Arc C PR3 fan-out hook lands here — for now the caller can
    // read `MobilityAlert` and drive push separately.
  }

  return NextResponse.json({ ok: true, matched: matches.length, inserted });
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
