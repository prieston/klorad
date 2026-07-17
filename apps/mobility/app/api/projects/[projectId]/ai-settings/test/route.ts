/**
 * POST /api/projects/[projectId]/ai-settings/test
 *
 * Hits Claude Haiku with a 1-token budget to confirm an API key
 * actually works. Body: `{ apiKey?: string }`.
 *   - With `apiKey`: tests the supplied key (paste-and-test before Save).
 *   - Without: tests the stored key.
 *
 * Returns `{ ok: true }` or `{ ok: false, error }` — the latter is
 * HTTP 200 so the client can render inline feedback without
 * tripping fetch-error handling.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { decryptSecret, secretsEnabled } from "@klorad/secrets";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
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
      where: { id: projectId },
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
