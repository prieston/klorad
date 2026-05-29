import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { decryptSecret, secretsEnabled } from "@/lib/secrets";

type Params = Promise<{ mapId: string }>;

/**
 * POST /api/maps/[mapId]/ai-settings/test
 *
 * Hits Claude Haiku with a 1-token max budget to confirm an API key
 * actually works. Body: `{ apiKey?: string }`.
 *   - With `apiKey`: tests the supplied key (used before Save so
 *     the admin can paste-and-test without committing).
 *   - Without: tests the stored key.
 *
 * Returns `{ ok: true }` or `{ ok: false, error }` — the latter is
 * still HTTP 200 so the client can show inline feedback without
 * tripping fetch-error handling.
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine — falls through to the stored-key path.
  }

  let apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim().length > 0
      ? body.apiKey.trim()
      : "";

  if (!apiKey) {
    if (!secretsEnabled()) {
      return NextResponse.json(
        { ok: false, error: "SECRETS_KEY isn't set on the server." },
        { status: 200 },
      );
    }
    const project = await prisma.project.findUnique({
      where: { id: mapId },
      select: { anthropicApiKeyEncrypted: true },
    });
    if (!project?.anthropicApiKeyEncrypted) {
      return NextResponse.json(
        { ok: false, error: "No key stored yet." },
        { status: 200 },
      );
    }
    try {
      apiKey = decryptSecret(project.anthropicApiKeyEncrypted);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Stored ciphertext didn't decrypt — was SECRETS_KEY rotated?",
        },
        { status: 200 },
      );
    }
  }

  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Anthropic call failed";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
