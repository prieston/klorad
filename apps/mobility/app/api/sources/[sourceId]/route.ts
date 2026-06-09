/**
 * PATCH /api/sources/[sourceId] — update a data source.
 *   Body: { label?, config?, credentials?, enabled?, pollIntervalSeconds? }
 *   Credentials, when present, replace the stored ciphertext wholesale.
 *
 * DELETE /api/sources/[sourceId] — drop a data source. Cascading
 *   deletes drop its devices, statuses and alerts.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { encryptCredentials } from "@/lib/mobility/data-source";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ sourceId: string }>;

const PatchBody = z.object({
  label: z.string().min(1).max(80).optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).nullable().optional(),
  enabled: z.boolean().optional(),
  pollIntervalSeconds: z.number().int().min(30).max(3600).optional(),
});

async function loadSourceProject(sourceId: string): Promise<string | null> {
  const row = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: { projectId: true },
  });
  return row?.projectId ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const projectId = await loadSourceProject(sourceId);
  if (!projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data: Prisma.MobilityDataSourceUpdateInput = {};
  if (parsed.data.label !== undefined) data.label = parsed.data.label;
  if (parsed.data.config !== undefined) {
    data.config = parsed.data.config as Prisma.InputJsonValue;
  }
  if (parsed.data.credentials !== undefined) {
    data.credentialsEncrypted = encryptCredentials(parsed.data.credentials);
  }
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.pollIntervalSeconds !== undefined) {
    data.pollIntervalSeconds = parsed.data.pollIntervalSeconds;
  }

  await prisma.mobilityDataSource.update({
    where: { id: sourceId },
    data,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const projectId = await loadSourceProject(sourceId);
  if (!projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(projectId, "manage");
  if (denied) return denied;

  await prisma.mobilityDataSource.delete({ where: { id: sourceId } });
  return NextResponse.json({ ok: true });
}
