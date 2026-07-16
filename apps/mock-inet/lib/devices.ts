/**
 * In-memory device store, hydrated once at cold-start from
 * `seed/devices.json` (built by `pnpm seed`). Vercel serverless keeps
 * this warm across invocations of the same instance.
 *
 * Filters here mirror the `WorldFilter` shape so world-scoped
 * endpoints reuse the same code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Device, Subsystem, WorldFilter } from "./types";
import { isSubsystem } from "./types";

let cache: Device[] | null = null;

/** Root of the deployed bundle. Vercel puts the built app at
 *  `/var/task/` (Node runtime); locally it's process.cwd(). Both cases
 *  can read the JSON directly because we mark it as an included
 *  asset via Next's `outputFileTracingIncludes` if needed — the file
 *  sits next to compiled server code either way. */
function seedPath(): string {
  return join(process.cwd(), "seed", "devices.json");
}

export function allDevices(): Device[] {
  if (cache) return cache;
  try {
    const raw = readFileSync(seedPath(), "utf8");
    cache = JSON.parse(raw) as Device[];
  } catch (err) {
    console.error("[devices] failed to read seed", err);
    cache = [];
  }
  return cache;
}

export function devicesBySubsystem(subsystem: Subsystem): Device[] {
  return allDevices().filter((d) => d.subsystem === subsystem);
}

export function deviceByExternalId(
  subsystem: Subsystem,
  externalId: string,
): Device | undefined {
  return devicesBySubsystem(subsystem).find(
    (d) => d.externalId === externalId,
  );
}

export interface ListParams {
  limit?: number;
  startId?: string;
  query?: string;
  lat?: number;
  lng?: number;
}

/**
 * Cursor-paginate a subsystem's devices. `startId` is the
 * `externalId` of the last item from the previous page. Terminates
 * when the caller has exhausted the list — matches the Parsons
 * behaviour the Klorad connector expects.
 */
export function pageDevices(
  subsystem: Subsystem,
  params: ListParams,
): Device[] {
  const limit = Math.max(1, Math.min(500, params.limit ?? 200));
  const all = devicesBySubsystem(subsystem);

  const startIdx = params.startId
    ? Math.max(0, all.findIndex((d) => d.externalId === params.startId) + 1)
    : 0;

  let page = all.slice(startIdx, startIdx + limit);

  if (params.query) {
    const q = params.query.toLowerCase();
    page = page.filter((d) => {
      const hay = [d.name, d.type, d.primaryRoad, d.crossRoad, d.chainage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return page;
}

/** Apply a `WorldFilter` to the whole device set. */
export function filterDevices(filter: WorldFilter): Device[] {
  return allDevices().filter((d) => {
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(d.subsystem)) return false;
    }
    if (filter.direction && d.direction !== filter.direction) return false;
    if (filter.area && filter.area.length > 0) {
      if (!d.area || !filter.area.includes(d.area)) return false;
    }
    if (filter.ids && filter.ids.length > 0) {
      if (!filter.ids.includes(d.externalId)) return false;
    }
    if (filter.bbox) {
      const [minLon, minLat, maxLon, maxLat] = filter.bbox;
      if (
        d.longitude < minLon ||
        d.longitude > maxLon ||
        d.latitude < minLat ||
        d.latitude > maxLat
      ) {
        return false;
      }
    }
    return true;
  });
}

/** Type guard used by route handlers when parsing the `[subsystem]`
 *  segment out of a URL path. */
export function parseSubsystem(value: string): Subsystem | null {
  return isSubsystem(value) ? value : null;
}

/**
 * Alias `vms` → `dms` so the legacy regional subsystem name still
 * resolves. Our seed now produces DMS-tagged rows (Parsons naming is
 * canonical in the Mobility picker), so `/atms/vms-rest/rest/vms/`
 * would return [] without this alias.
 *
 * Note: if an operator ticks *both* dms and vms on their source,
 * they'll double-sync the same physical signs. Pick one — DMS is the
 * canonical name.
 */
export function fetchFromSubsystem(requested: Subsystem): Subsystem {
  return requested === "vms" ? "dms" : requested;
}

/**
 * Per-subsystem live status — what the per-device status endpoint
 * (path shape `/atms/{sub}-rest/rest/{sub}/{id}/status`) returns.
 * DMS/VMS/VSLS reuse the pre-baked NTCIP-shaped status from the seed.
 * CCTV/AID/RADAR get lightweight computed shapes so the Mobility
 * drawer has something to render for them (previously radar and aid
 * showed "no live data — the source returned no current status").
 *
 * All shapes carry `signId`, `connectable`, `timestamp` so the
 * connector's normaliser (`RawStatusSchema` — every field `.nullish()`
 * and `.passthrough()`) accepts them. Subsystem-specific extras
 * (volume/speed for radar, eventCount for aid) pass through into the
 * drawer's `live.status.raw` blob.
 */
export function currentStatus(device: Device): Record<string, unknown> {
  const now = Date.now();
  const base = {
    signId: device.externalId,
    connectable: true,
    timestamp: now,
  };

  switch (device.subsystem) {
    case "vms":
    case "vsls":
    case "dms":
      return device.status
        ? { ...device.status, timestamp: now }
        : base;

    case "cctv":
      // Cameras have no NTCIP-style status on Parsons — just report
      // reachability and let the drawer render the stream URL.
      return base;

    case "aid": {
      // Fake event count + last detection driven by the current hour
      // so successive polls tell a coherent story within a demo.
      const hourBucket = Math.floor(now / 3_600_000);
      const seed =
        [...device.externalId].reduce((a, c) => a + c.charCodeAt(0), 0) +
        hourBucket;
      const eventCount = seed % 5;
      const minutesAgo = seed % 55;
      return {
        ...base,
        eventCount,
        lastDetection:
          eventCount > 0
            ? new Date(now - minutesAgo * 60_000).toISOString()
            : null,
        message:
          eventCount > 0
            ? `${eventCount} incident${eventCount === 1 ? "" : "s"} detected in the last hour`
            : "No incidents detected",
      };
    }

    case "radar": {
      // Synthetic traffic snapshot per radar. Deterministic per
      // device + 5-second time bucket so successive polls return the
      // same values within a bucket and vary between — reads as
      // "live but not jittery" for a demo. Rush-hour bump matches
      // the pattern in `lib/vds.ts`.
      const bucket = Math.floor(now / 5000);
      const seed =
        [...device.externalId].reduce((a, c) => a + c.charCodeAt(0), 0) +
        bucket;
      const rush = isRushHour(now);
      const baseVolume = rush ? 90 : 40;
      const baseSpeed = rush ? 65 : 95;
      const jitter = () => ((seed * 9301 + 49297) % 233280) / 233280 - 0.5;
      const volume = Math.max(0, Math.round(baseVolume + jitter() * 20));
      const speed = Math.max(5, Math.round(baseSpeed + jitter() * 12));
      const occupancy = Math.min(1, Math.max(0, volume / 120));
      return {
        ...base,
        volume,
        speed,
        occupancy: Number(occupancy.toFixed(3)),
        perLane: [1, 2, 3].map((lane) => ({
          lane,
          volume: Math.max(0, Math.round(volume / 3 + jitter() * 6)),
          speed: Math.max(5, Math.round(speed + jitter() * 5)),
          occupancy: Number(
            Math.min(1, Math.max(0, occupancy + jitter() * 0.05)).toFixed(3),
          ),
        })),
      };
    }
  }
}

function isRushHour(now: number): boolean {
  const d = new Date(now);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return (
    (minutes >= 7 * 60 + 30 && minutes < 9 * 60 + 30) ||
    (minutes >= 17 * 60 && minutes < 19 * 60)
  );
}
