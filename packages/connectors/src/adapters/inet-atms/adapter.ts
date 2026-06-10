/**
 * iNET ATMS adapter — the first @klorad/connectors implementation.
 *
 * Two modes share one code path:
 *   - fixture: yields the seeded Thessaloniki devices so the whole
 *     Mobility UI works offline before credentials arrive.
 *   - live: makes real HTTP calls against the configured host.
 *
 * One adapter instance serves all enabled subsystems for the tenant
 * (cctv + dms today; the union in `types.ts` is the source of truth
 * for what's supported). `listEntities` walks each subsystem in
 * turn, paginates via the ATMS `start_id` cursor, and yields one
 * page at a time so the caller persists as data arrives.
 *
 * The connector framework's single-id contract (`getEntity(id)` /
 * `getStatus(ids)`) is honoured by packing the subsystem into the
 * id (`cctv:24432`), so the framework stays subsystem-agnostic.
 */
import type {
  ConnectionTestResult,
  EntityPage,
  KloradConnector,
  ListParams,
} from "../../types.js";
import {
  FIXTURE_DEVICES,
  FIXTURE_STATUSES,
} from "./fixture.js";
import { createInetHttpClient, type InetHttpClient } from "./client.js";
import {
  InetAtmsConfigSchema,
  RawCctvDeviceSchema,
  RawDmsDeviceSchema,
  RawStatusSchema,
  type InetAtmsConfig,
  type InetDevice,
  type InetMedia,
  type InetStatus,
  type InetSubsystem,
  type RawCctvDevice,
  type RawDmsDevice,
  type RawStatus,
} from "./types.js";

const DEFAULT_PAGE_SIZE = 100;

export const INET_ATMS_CONNECTOR_ID = "inet-atms";

/** Pack / unpack the subsystem-tagged id. */
function packId(subsystem: InetSubsystem, externalId: string): string {
  return `${subsystem}:${externalId}`;
}
function unpackId(deviceId: string): {
  subsystem: InetSubsystem;
  externalId: string;
} | null {
  const [subsystem, externalId, ...rest] = deviceId.split(":");
  if (
    rest.length > 0 ||
    !subsystem ||
    !externalId ||
    !(subsystem === "cctv" || subsystem === "dms")
  ) {
    return null;
  }
  return { subsystem, externalId };
}

function normaliseCctv(raw: RawCctvDevice): InetDevice {
  const externalId = raw.deviceId;
  // Stream priority: explicit hlsUri (when hlsInd is on), then dashUri,
  // then cameraIpAddr (which in the live Parsons demo *is* the m3u8 URL),
  // then multicastAddr / channelUri as final fallbacks.
  const stream =
    (raw.hlsInd && raw.hlsUri) ||
    raw.hlsUri ||
    raw.dashUri ||
    raw.cameraIpAddr ||
    raw.multicastAddr ||
    raw.channelUri ||
    null;
  const media: InetMedia | null = stream
    ? {
        kind: "cctv-stream",
        url: stream,
        streamType: stream.includes(".m3u8")
          ? "hls"
          : stream.includes(".mpd")
            ? "hls" // dash labelled as hls for the player picker; v1 doesn't have a dash branch
            : "mp4",
      }
    : null;
  return {
    deviceId: packId("cctv", externalId),
    externalId,
    subsystem: "cctv",
    type: raw.type ?? null,
    lat: raw.latitude ?? null,
    lng: raw.longitude ?? null,
    mileMarker:
      raw.mileMarker != null ? String(raw.mileMarker) : null,
    primaryRoad: raw.primaryRoad ?? null,
    crossRoad: raw.crossRoad ?? null,
    direction: raw.direction ?? null,
    routeId: raw.routeId != null ? String(raw.routeId) : null,
    agency: raw.agency ?? null,
    name: raw.name ?? `CCTV ${externalId}`,
    media,
  };
}

function normaliseDms(raw: RawDmsDevice): InetDevice {
  const externalId = raw.deviceId;
  return {
    deviceId: packId("dms", externalId),
    externalId,
    subsystem: "dms",
    type: raw.type ?? (raw.signType != null ? `signType ${raw.signType}` : null),
    lat: raw.latitude ?? null,
    lng: raw.longitude ?? null,
    mileMarker:
      raw.mileMarker != null ? String(raw.mileMarker) : null,
    primaryRoad: raw.primaryRoad ?? null,
    crossRoad: raw.crossRoad ?? null,
    direction: raw.direction ?? null,
    routeId: null, // DMS records don't carry a routeId in the live API.
    agency: raw.agency ?? null,
    name: raw.name ?? `DMS ${externalId}`,
    media: null,
  };
}

/** Decode the NTCIP short-status bitfield into a single human-facing
 *  alarm string. Zero is healthy. Anything else collapses to "Fault
 *  bits: 0x…" in v1 — a per-bit lookup table can land later once
 *  we know which bits we want operator-visible. */
function shortStatusToAlarm(s: number | null | undefined): string | null {
  if (typeof s !== "number" || s === 0) return null;
  return `Fault bits 0x${s.toString(16).toUpperCase()}`;
}

function normaliseStatus(deviceId: string, raw: RawStatus): InetStatus {
  const observedAt =
    typeof raw.timestamp === "number"
      ? new Date(raw.timestamp).toISOString()
      : new Date().toISOString();
  return {
    deviceId,
    online: raw.connectable === true,
    alarm: shortStatusToAlarm(raw.shortStatus ?? null),
    observedAt,
    // Flatten the brightness + photocell levels into the surface
    // shape the dashboard already reads (`raw.brightness`,
    // `raw.photocell`). The DMS face renderer pulls from `.brightness`
    // — saves changing the consumer in this pass.
    raw: {
      ...raw,
      brightness: raw.brightnessLevel?.current ?? null,
      photocell: raw.photocellLevel?.current ?? null,
      lightOutput: raw.lightOutput?.current ?? null,
    },
  };
}

/** The connector type the registry binds to. */
export type InetAtmsConnector = KloradConnector<
  InetAtmsConfig,
  InetDevice,
  InetStatus
>;

export function createInetAtmsConnector(): InetAtmsConnector {
  let config: InetAtmsConfig | null = null;
  let client: InetHttpClient | null = null;

  function requireConfig(): InetAtmsConfig {
    if (!config) {
      throw new Error("[inet-atms] connector used before configure()");
    }
    return config;
  }

  async function* listLive(
    subsystem: InetSubsystem,
    params: ListParams | undefined,
  ): AsyncIterable<EntityPage<InetDevice>> {
    const live = client;
    if (!live) throw new Error("[inet-atms] live client not initialised");
    const limit = params?.limit ?? DEFAULT_PAGE_SIZE;
    let cursor: string | undefined = params?.cursor;
    while (true) {
      const search = new URLSearchParams();
      search.set("limit", String(limit));
      if (cursor) search.set("start_id", cursor);
      if (params?.query) search.set("query", params.query);
      if (params?.near) {
        search.set("lat", String(params.near.lat));
        search.set("lng", String(params.near.lng));
      }
      for (const s of params?.sort ?? []) search.append("sort_by", s);
      const raw = (await live.getJson<unknown[]>(
        subsystem,
        "",
        search,
      )) as unknown[];
      const items: InetDevice[] = [];
      for (const entry of raw) {
        if (subsystem === "cctv") {
          const parsed = RawCctvDeviceSchema.safeParse(entry);
          if (parsed.success) items.push(normaliseCctv(parsed.data));
        } else if (subsystem === "dms") {
          const parsed = RawDmsDeviceSchema.safeParse(entry);
          if (parsed.success) items.push(normaliseDms(parsed.data));
        }
      }
      const nextCursor =
        items.length === limit ? items[items.length - 1]?.externalId ?? null : null;
      yield { items, nextCursor };
      if (!nextCursor) break;
      cursor = nextCursor;
    }
  }

  async function* listFixture(
    subsystem: InetSubsystem,
  ): AsyncIterable<EntityPage<InetDevice>> {
    yield { items: FIXTURE_DEVICES[subsystem], nextCursor: null };
  }

  return {
    id: INET_ATMS_CONNECTOR_ID,

    async configure(input: InetAtmsConfig): Promise<void> {
      config = InetAtmsConfigSchema.parse(input);
      client = config.mode === "live" ? createInetHttpClient(config) : null;
    },

    async testConnection(): Promise<ConnectionTestResult> {
      const c = requireConfig();
      if (c.mode === "fixture") {
        return {
          ok: true,
          meta: { mode: "fixture", subsystems: c.subsystems },
        };
      }
      if (!client) {
        return { ok: false, error: "live client not initialised" };
      }
      try {
        // Probe each enabled subsystem with a single-item list — the
        // cheapest call that proves auth + reachability.
        for (const subsystem of c.subsystems) {
          const probe = new URLSearchParams({ limit: "1" });
          await client.getJson<unknown[]>(subsystem, "", probe);
        }
        return { ok: true, meta: { subsystems: c.subsystems } };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },

    async *listEntities(
      params?: ListParams,
    ): AsyncIterable<EntityPage<InetDevice>> {
      const c = requireConfig();
      for (const subsystem of c.subsystems) {
        const stream =
          c.mode === "fixture"
            ? listFixture(subsystem)
            : listLive(subsystem, params);
        for await (const page of stream) {
          yield page;
        }
      }
    },

    async getEntity(deviceId: string): Promise<InetDevice | null> {
      const c = requireConfig();
      const unpacked = unpackId(deviceId);
      if (!unpacked) return null;
      if (c.mode === "fixture") {
        return (
          FIXTURE_DEVICES[unpacked.subsystem].find(
            (d) => d.deviceId === deviceId,
          ) ?? null
        );
      }
      if (!client) return null;
      try {
        const raw = await client.getJson<unknown>(
          unpacked.subsystem,
          `/${unpacked.externalId}`,
        );
        if (unpacked.subsystem === "cctv") {
          const parsed = RawCctvDeviceSchema.safeParse(raw);
          return parsed.success ? normaliseCctv(parsed.data) : null;
        }
        const parsed = RawDmsDeviceSchema.safeParse(raw);
        return parsed.success ? normaliseDms(parsed.data) : null;
      } catch {
        return null;
      }
    },

    async getStatus(deviceIds: string[]): Promise<Record<string, InetStatus>> {
      const c = requireConfig();
      const out: Record<string, InetStatus> = {};
      if (c.mode === "fixture") {
        for (const id of deviceIds) {
          const s = FIXTURE_STATUSES[id];
          if (s) out[id] = s;
        }
        return out;
      }
      if (!client) return out;
      // The ATMS REST surface is one-id-per-call for status; fan out
      // in parallel. Caller is expected to chunk to a sensible batch.
      // CCTV records don't carry status on the device GET (the field is
      // null) and there's no documented per-id CCTV status endpoint,
      // so for CCTV we synthesise a minimal `online: true` from the
      // device record's `active` flag fetched on getEntity. For now
      // CCTV status is just an empty record; the dashboard treats
      // missing entries as "no live data" and the drawer still shows
      // the device's static fields.
      await Promise.all(
        deviceIds.map(async (id) => {
          const unpacked = unpackId(id);
          if (!unpacked || unpacked.subsystem !== "dms") return;
          try {
            const raw = await client!.getJson<unknown>(
              unpacked.subsystem,
              `/${unpacked.externalId}/status`,
            );
            // The /status endpoint returns either the object directly
            // or an array of one entry — tolerate both.
            const candidate = Array.isArray(raw) ? raw[0] : raw;
            const parsed = RawStatusSchema.safeParse(candidate);
            if (parsed.success) {
              out[id] = normaliseStatus(id, parsed.data);
            }
          } catch {
            // Skip — the row simply won't appear in the result.
          }
        }),
      );
      return out;
    },
  };
}
