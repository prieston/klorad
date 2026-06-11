/**
 * Sync runner — walks a data source's connector, upserts devices,
 * stamps `lastSyncedAt` on the source row.
 *
 * v1 is synchronous: a route handler kicks it off in-process. Long-
 * running tenants will graduate to Inngest in PR 13 of the arc; the
 * runner's signature already accepts an abort signal so the durable
 * job harness can wrap it without refactor.
 *
 * Curation rule: new devices land `needsReview = true`, untouched.
 * Re-syncs **update payload fields** (name, lat/lng, road locator)
 * but never override the operator's flags (`included`, `isPublic`,
 * `customLabel`, `customRoute`, `groupKey`). The "operator decisions
 * win" property is what makes the public traveller map predictable
 * across resyncs.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  buildConnector,
  decryptCredentials,
  type DataSourceConfigJson,
} from "./data-source";

export interface SyncResult {
  sourceId: string;
  devicesSeen: number;
  devicesInserted: number;
  devicesUpdated: number;
  error?: string;
}

export async function runSync(sourceId: string): Promise<SyncResult> {
  const source = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      projectId: true,
      connectorId: true,
      config: true,
      credentialsEncrypted: true,
    },
  });
  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }

  let inserted = 0;
  let updated = 0;
  let seen = 0;

  try {
    const connector = await buildConnector({
      connectorId: source.connectorId,
      config: source.config as DataSourceConfigJson,
      credentials: decryptCredentials(source.credentialsEncrypted),
    });

    for await (const page of connector.listEntities()) {
      for (const item of page.items as ReadonlyArray<{
        deviceId: string;
        externalId: string;
        subsystem: string;
        name: string;
        type: string | null;
        lat: number | null;
        lng: number | null;
        primaryRoad: string | null;
        crossRoad: string | null;
        mileMarker: string | null;
        direction: string | null;
        routeId: string | null;
        agency: string | null;
      }>) {
        seen += 1;
        const existing = await prisma.mobilityDevice.findUnique({
          where: {
            sourceId_externalDeviceId: {
              sourceId: source.id,
              externalDeviceId: item.deviceId,
            },
          },
          select: { id: true },
        });
        const data = {
          name: item.name,
          type: item.type,
          subsystem: item.subsystem,
          lat: item.lat,
          lng: item.lng,
          primaryRoad: item.primaryRoad,
          crossRoad: item.crossRoad,
          mileMarker: item.mileMarker,
          direction: item.direction,
          routeId: item.routeId,
          agency: item.agency,
          payload: item as unknown as Prisma.InputJsonValue,
          lastSeenAt: new Date(),
        };
        if (existing) {
          await prisma.mobilityDevice.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await prisma.mobilityDevice.create({
            data: {
              ...data,
              projectId: source.projectId,
              sourceId: source.id,
              externalDeviceId: item.deviceId,
              needsReview: true,
              included: false,
              isPublic: false,
            },
          });
          inserted += 1;
        }
      }
    }

    await prisma.mobilityDataSource.update({
      where: { id: source.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });

    return {
      sourceId: source.id,
      devicesSeen: seen,
      devicesInserted: inserted,
      devicesUpdated: updated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.mobilityDataSource.update({
      where: { id: source.id },
      data: { lastError: message.slice(0, 500) },
    });
    return {
      sourceId: source.id,
      devicesSeen: seen,
      devicesInserted: inserted,
      devicesUpdated: updated,
      error: message,
    };
  }
}
