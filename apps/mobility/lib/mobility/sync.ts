/**
 * Sync runner — walks a data source's connector, upserts devices,
 * writes progress to the source row per page so the UI can render a
 * real progress card.
 *
 * Curation rule: new devices land `needsReview = true`, untouched.
 * Re-syncs **update payload fields** (name, lat/lng, road locator)
 * but never override the operator's flags (`included`, `isPublic`,
 * `customLabel`, `customRoute`, `groupKey`). The "operator decisions
 * win" property is what makes the public traveller map predictable
 * across resyncs.
 *
 * Routing:
 *   • POST /api/sources/[id]/sync schedules `runSync` via Next's
 *     `after()` so the response returns immediately and the work runs
 *     in the post-response budget.
 *   • The runner updates `syncStatus` + `syncProgress` on the source
 *     row after every page; the dashboard polls the source list to
 *     render the live counters.
 *   • On Vercel Pro this fits in ~300s after-response budget; on
 *     Hobby (60s) larger fleets need durable jobs (Inngest follow-up).
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

/** Shape of the JSON we write into `MobilityDataSource.syncProgress`.
 *  Kept narrow so the polling endpoint can return it verbatim. */
export interface SyncProgress {
  /** Subsystem currently being walked (e.g. "cctv", "dms"), or null
   *  when work hasn't started / has finished. */
  subsystem: string | null;
  /** Pages completed so far. */
  page: number;
  /** Cumulative items seen this run. */
  seen: number;
  /** Cumulative inserts this run. */
  inserted: number;
  /** Cumulative updates this run. */
  updated: number;
  /** Optional short note shown under the progress bar. */
  message?: string;
}

/**
 * Mark a source as starting a sync. Returns immediately so the POST
 * endpoint can hand control back to the client before the actual work
 * begins (runs via Next `after()`).
 */
export async function markSyncStarted(sourceId: string): Promise<void> {
  await prisma.mobilityDataSource.update({
    where: { id: sourceId },
    data: {
      syncStatus: "running",
      syncStartedAt: new Date(),
      syncProgress: {
        subsystem: null,
        page: 0,
        seen: 0,
        inserted: 0,
        updated: 0,
        message: "Initialising connector",
      } satisfies SyncProgress as unknown as Prisma.InputJsonValue,
      lastError: null,
    },
  });
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

  // Intentional server-side progress trace; `console.warn` is allowed
  // by our eslint config.
  const log = (msg: string) =>
    console.warn(`[mobility:sync ${source.id}] ${msg}`);
  log(`starting sync via ${source.connectorId}`);
  const startedAt = Date.now();

  /** Persist progress to the source row so the polling UI can read it. */
  const writeProgress = async (next: SyncProgress) => {
    try {
      await prisma.mobilityDataSource.update({
        where: { id: source.id },
        data: {
          syncProgress: next as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Don't let progress writes derail the actual sync.
      log(
        `progress write failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  };

  try {
    const connector = await buildConnector({
      connectorId: source.connectorId,
      config: source.config as DataSourceConfigJson,
      credentials: decryptCredentials(source.credentialsEncrypted),
    });

    let pageIdx = 0;
    for await (const page of connector.listEntities()) {
      pageIdx += 1;
      log(`page ${pageIdx}: ${page.items.length} items returned`);
      const subsystemOfPage =
        (page.items as ReadonlyArray<{ subsystem: string }>)[0]?.subsystem ??
        null;

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

      // Per-page progress write — cheap enough at one row per ~30s.
      await writeProgress({
        subsystem: subsystemOfPage,
        page: pageIdx,
        seen,
        inserted,
        updated,
        message: `Page ${pageIdx} · ${page.items.length} items`,
      });
    }

    const finishedAt = new Date();
    await prisma.mobilityDataSource.update({
      where: { id: source.id },
      data: {
        lastSyncedAt: finishedAt,
        lastError: null,
        syncStatus: "done",
        syncProgress: {
          subsystem: null,
          page: pageIdx,
          seen,
          inserted,
          updated,
          message: `Finished: ${seen} seen · ${inserted} new · ${updated} updated`,
        } satisfies SyncProgress as unknown as Prisma.InputJsonValue,
      },
    });
    const took = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(
      `done in ${took}s: ${seen} seen / ${inserted} new / ${updated} updated`,
    );

    return {
      sourceId: source.id,
      devicesSeen: seen,
      devicesInserted: inserted,
      devicesUpdated: updated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`error: ${message}`);
    await prisma.mobilityDataSource.update({
      where: { id: source.id },
      data: {
        lastError: message.slice(0, 500),
        syncStatus: "failed",
        syncProgress: {
          subsystem: null,
          page: 0,
          seen,
          inserted,
          updated,
          message: message.slice(0, 200),
        } satisfies SyncProgress as unknown as Prisma.InputJsonValue,
      },
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
