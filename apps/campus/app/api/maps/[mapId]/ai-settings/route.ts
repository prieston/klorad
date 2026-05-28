import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsEnabled,
} from "@/lib/secrets";

type Params = Promise<{ mapId: string }>;

/**
 * GET /api/maps/[mapId]/ai-settings
 *
 * Returns the status of the campus's AI configuration. Never returns
 * the plaintext key — only `{ hasKey, masked, secretsEnabled }`.
 *
 *   - `hasKey`: a key is stored for this campus.
 *   - `masked`: display-safe slug ("sk-ant-…••••8f2c") when present.
 *   - `secretsEnabled`: whether `SECRETS_KEY` is configured on the
 *     server — if false, write attempts will 503.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { anthropicApiKeyEncrypted: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let masked: string | null = null;
  if (project.anthropicApiKeyEncrypted && secretsEnabled()) {
    try {
      masked = maskSecret(decryptSecret(project.anthropicApiKeyEncrypted));
    } catch (err) {
      console.error("[ai-settings] decrypt failed", err);
    }
  }

  return NextResponse.json({
    hasKey: Boolean(project.anthropicApiKeyEncrypted),
    masked,
    secretsEnabled: secretsEnabled(),
  });
}

/**
 * PATCH /api/maps/[mapId]/ai-settings
 *
 * Body: `{ apiKey: string | null }`.
 *   - String → validates the prefix, encrypts, stores.
 *   - `null` → clears the stored key, campus falls back to env.
 *
 * 503 when `SECRETS_KEY` isn't configured server-side — refuses
 * rather than silently storing plaintext.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Clear flow.
  if (body.apiKey === null) {
    await prisma.project.update({
      where: { id: mapId },
      data: { anthropicApiKeyEncrypted: null },
    });
    return NextResponse.json({ ok: true, hasKey: false, masked: null });
  }

  // Set / update flow.
  if (!secretsEnabled()) {
    return NextResponse.json(
      {
        error:
          "SECRETS_KEY isn't set on the server — needed to encrypt at-rest secrets.",
      },
      { status: 503 },
    );
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "apiKey is required" },
      { status: 400 },
    );
  }
  if (!apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Anthropic keys start with sk-ant-" },
      { status: 400 },
    );
  }

  const encrypted = encryptSecret(apiKey);
  await prisma.project.update({
    where: { id: mapId },
    data: { anthropicApiKeyEncrypted: encrypted },
  });

  return NextResponse.json({
    ok: true,
    hasKey: true,
    masked: maskSecret(apiKey),
  });
}
