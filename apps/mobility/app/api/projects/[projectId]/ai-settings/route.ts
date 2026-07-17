/**
 * GET   /api/projects/[projectId]/ai-settings — returns
 *         `{ hasKey, masked, secretsEnabled }`. Never plaintext.
 * PATCH /api/projects/[projectId]/ai-settings — body
 *         `{ apiKey: string | null }`. String encrypts + stores;
 *         `null` clears (falls back to platform env var). Requires
 *         `SECRETS_KEY` to encrypt.
 *
 * Same pattern as Campus's `/api/maps/[mapId]/ai-settings` — the
 * `Project.anthropicApiKeyEncrypted` column is shared across both
 * apps (schema is in `packages/prisma`), so no migration needed
 * for Mobility.
 */
import { NextResponse } from "next/server";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsEnabled,
} from "@klorad/secrets";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
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

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.apiKey === null) {
    await prisma.project.update({
      where: { id: projectId },
      data: { anthropicApiKeyEncrypted: null },
    });
    return NextResponse.json({ ok: true, hasKey: false, masked: null });
  }

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
    where: { id: projectId },
    data: { anthropicApiKeyEncrypted: encrypted },
  });

  return NextResponse.json({
    ok: true,
    hasKey: true,
    masked: maskSecret(apiKey),
  });
}
