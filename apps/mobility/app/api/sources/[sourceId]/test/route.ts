/**
 * POST /api/sources/[sourceId]/test
 * Run the connector's `testConnection()` against the stored config
 * + decrypted credentials, return the result. No DB writes — the
 * settings UI calls this from the "Test connection" button before
 * the operator saves a change.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "@/lib/mobility/data-source";

type Params = Promise<{ sourceId: string }>;

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const source = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: {
      projectId: true,
      connectorId: true,
      config: true,
      credentialsEncrypted: true,
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(source.projectId, "write");
  if (denied) return denied;

  try {
    const connector = await buildConnector({
      connectorId: source.connectorId,
      config: source.config as DataSourceConfigJson,
      credentials: decryptCredentials(source.credentialsEncrypted),
    });
    const result = await connector.testConnection();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 200 },
    );
  }
}
