/**
 * GET /api/projects/[projectId]/sources — list the project's data sources.
 * POST /api/projects/[projectId]/sources — create a new data source.
 *
 * Credentials in the POST body are encrypted via @klorad/secrets
 * before persistence; the request body is server-only and never logged.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { mobilityConnectors } from "@/lib/connectors";
import { encryptCredentials } from "@/lib/mobility/data-source";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string }>;

const CreateBody = z.object({
  connectorId: z.string(),
  label: z.string().min(1).max(80),
  /** Adapter-specific config (e.g. host, subsystems, mode). */
  config: z.record(z.unknown()),
  /** Adapter-specific credentials. Null when the adapter doesn't
   *  need them (fixture mode). */
  credentials: z.record(z.unknown()).nullable(),
  /** Optional override for the source-level poll interval. */
  pollIntervalSeconds: z.number().int().min(30).max(3600).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const rows = await prisma.mobilityDataSource.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      connectorId: true,
      label: true,
      config: true,
      enabled: true,
      pollIntervalSeconds: true,
      lastSyncedAt: true,
      lastError: true,
      // Live-sync state so the client can render a progress card +
      // poll for updates while a sync is in flight.
      syncStatus: true,
      syncStartedAt: true,
      syncProgress: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ sources: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const factory = mobilityConnectors.get(parsed.data.connectorId);
  if (!factory) {
    return NextResponse.json(
      { error: `Unknown connector "${parsed.data.connectorId}"` },
      { status: 400 },
    );
  }

  // Validate the combined config+credentials shape against the
  // adapter's Zod schema before we touch the DB — better to reject
  // bad input now than to find out at sync time.
  const merged = {
    ...parsed.data.config,
    ...(parsed.data.credentials ?? {}),
  };
  const adapterParsed = factory.configSchema.safeParse(merged);
  if (!adapterParsed.success) {
    const first = adapterParsed.error.issues[0];
    const detail = first
      ? `${first.path.join(".") || "config"}: ${first.message}`
      : "Invalid adapter config";
    return NextResponse.json(
      {
        error: `Invalid adapter config — ${detail}`,
        issues: adapterParsed.error.issues,
      },
      { status: 400 },
    );
  }

  const created = await prisma.mobilityDataSource.create({
    data: {
      projectId,
      connectorId: parsed.data.connectorId,
      label: parsed.data.label,
      config: parsed.data.config as Prisma.InputJsonValue,
      credentialsEncrypted: encryptCredentials(parsed.data.credentials),
      pollIntervalSeconds: parsed.data.pollIntervalSeconds ?? 300,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id });
}
