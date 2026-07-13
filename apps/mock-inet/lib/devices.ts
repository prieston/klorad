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
