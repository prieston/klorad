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

/** Any sync still marked `running` after this many ms is assumed
 *  dead (Vercel `after()` budget exceeded mid-page). The route resets
 *  it before kicking off a fresh run instead of leaving the operator
 *  permanently stuck. */
export const STALE_SYNC_AFTER_MS = 10 * 60 * 1000;

/**
 * Treat a source's sync as stale if it has been "running" longer than
 * the after() budget could plausibly cover. Flips the row back to
 * `failed` so the caller can start a fresh run.
 */
export async function recoverStaleSync(sourceId: string): Promise<boolean> {
  const row = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: { syncStatus: true, syncStartedAt: true },
  });
  if (row?.syncStatus !== "running") return false;
  if (
    row.syncStartedAt &&
    Date.now() - row.syncStartedAt.getTime() < STALE_SYNC_AFTER_MS
  ) {
    return false;
  }
  await prisma.mobilityDataSource.update({
    where: { id: sourceId },
    data: {
      syncStatus: "failed",
      lastError: "Previous sync was killed mid-run (server budget exceeded).",
    },
  });
  return true;
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

      // Bulk-upsert the page: 1 query to discover what already exists,
      // 1 `createMany` for new rows, parallel chunked updates for the
      // rest. Drops per-page cost from O(N) sequential roundtrips
      // (~30s for 200 items via Accelerate) to ~1s, so subsequent
      // pages + subsystems actually finish inside the after() budget.
      type PageItem = {
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
      };
      const items = page.items as ReadonlyArray<PageItem>;
      seen += items.length;
      if (items.length === 0) {
        await writeProgress({
          subsystem: subsystemOfPage,
          page: pageIdx,
          seen,
          inserted,
          updated,
          message: `Page ${pageIdx} · 0 items`,
        });
        continue;
      }

      const externalIds = items.map((i) => i.externalId);
      const existingRows = await prisma.mobilityDevice.findMany({
        where: {
          sourceId: source.id,
          externalDeviceId: { in: externalIds },
        },
        select: { id: true, externalDeviceId: true },
      });
      const existingIdByExternal = new Map(
        existingRows.map((r) => [r.externalDeviceId, r.id]),
      );

      const toCreate: Array<Prisma.MobilityDeviceCreateManyInput> = [];
      const toUpdate: Array<{
        id: string;
        data: Prisma.MobilityDeviceUpdateInput;
      }> = [];
      for (const item of items) {
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
        const existingId = existingIdByExternal.get(item.externalId);
        if (existingId) {
          // Re-sync rule: refresh source-driven fields, never touch
          // operator decisions (included / isPublic / customLabel /
          // customRoute / groupKey / needsReview). The latter stays
          // sticky across syncs by design.
          toUpdate.push({ id: existingId, data });
        } else {
          toCreate.push({
            ...data,
            projectId: source.projectId,
            sourceId: source.id,
            // `item.deviceId` is the connector's packed id
            // ("cctv:24432"). We store the raw one so source-URL
            // building + per-device API calls work out of the box —
            // the connector framework re-packs on demand.
            externalDeviceId: item.externalId,
            needsReview: true,
            included: false,
            isPublic: false,
          });
        }
      }

      if (toCreate.length) {
        await prisma.mobilityDevice.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        inserted += toCreate.length;
      }
      if (toUpdate.length) {
        // Chunk parallel updates so we don't blow past Accelerate's
        // connection pool on a wide page.
        const CHUNK = 25;
        for (let i = 0; i < toUpdate.length; i += CHUNK) {
          const slice = toUpdate.slice(i, i + CHUNK);
          await Promise.all(
            slice.map((u) =>
              prisma.mobilityDevice.update({
                where: { id: u.id },
                data: u.data,
              }),
            ),
          );
        }
        updated += toUpdate.length;
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
