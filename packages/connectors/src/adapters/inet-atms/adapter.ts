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
  INET_SUBSYSTEMS,
  InetAtmsConfigSchema,
  RawAidDeviceSchema,
  RawCctvDeviceSchema,
  RawDmsDeviceSchema,
  RawRadarDeviceSchema,
  RawStatusSchema,
  RawVmsDeviceSchema,
  RawVslsDeviceSchema,
  type InetAtmsConfig,
  type InetDevice,
  type InetMedia,
  type InetStatus,
  type InetSubsystem,
  type RawAidDevice,
  type RawCctvDevice,
  type RawDmsDevice,
  type RawRadarDevice,
  type RawStatus,
  type RawVmsDevice,
  type RawVslsDevice,
} from "./types.js";

/** Subsystems that expose a `/status` endpoint. Parsons only documents
 *  the DMS shape (and VMS is the regional alias for the same); we
 *  extend to CCTV / AID / RADAR here so the operator drawer can show
 *  reachability + subsystem-specific telemetry for the PSMdt demo
 *  fleet. The tolerant `RawStatusSchema.passthrough()` in `types.ts`
 *  accepts whatever the source returns — subsystem-specific fields
 *  (radar's volume/speed, aid's eventCount) reach the drawer via
 *  `InetStatus.raw`. Hosts that don't implement `/status` for these
 *  subsystems return an empty body and we silently skip them (the
 *  fan-out is a `try/catch`, no crash on 404). */
const STATUS_ENABLED_SUBSYSTEMS: ReadonlySet<InetSubsystem> = new Set([
  "cctv",
  "dms",
  "vms",
  "vsls",
  "aid",
  "radar",
]);

const DEFAULT_PAGE_SIZE = 200;
/** Safety brake — stop walking pages after this many round-trips even
 *  if the API claims more remain. Protects against APIs that ignore
 *  `start_id` and keep returning the same set. */
const MAX_PAGES = 20;

export const INET_ATMS_CONNECTOR_ID = "inet-atms";

/** Pack / unpack the subsystem-tagged id. */
function packId(subsystem: InetSubsystem, externalId: string): string {
  return `${subsystem}:${externalId}`;
}
function isInetSubsystem(value: string | undefined): value is InetSubsystem {
  return (
    typeof value === "string" &&
    (INET_SUBSYSTEMS as readonly string[]).includes(value)
  );
}

function unpackId(deviceId: string): {
  subsystem: InetSubsystem;
  externalId: string;
} | null {
  const [subsystem, externalId, ...rest] = deviceId.split(":");
  if (rest.length > 0 || !externalId || !isInetSubsystem(subsystem)) {
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
  // No stream — fall back to a snapshot image when the device record's
  // top-level `url` is a JPG/PNG. Some iNET tenants don't expose
  // streams at all; the snapshot is still a useful live signal.
  const isImageUrl = (u: string | null | undefined): u is string =>
    typeof u === "string" &&
    u.length > 0 &&
    /\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(u);
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
    : isImageUrl(raw.url)
      ? { kind: "cctv-snapshot", url: raw.url as string }
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

// ─────────────────────────────────────────────────────────────
// PSMdt-iNET demo subsystems (aid / vms / vsls / radar)
//
// Each shares wire shape with an existing subsystem — see the aliased
// schemas in `types.ts`. Normalisers stay tiny by delegating to the
// parent normaliser and swapping the packed id + subsystem tag.
// ─────────────────────────────────────────────────────────────

function normaliseAid(raw: RawAidDevice): InetDevice {
  const base = normaliseCctv(raw);
  return {
    ...base,
    deviceId: packId("aid", base.externalId),
    subsystem: "aid",
    name: raw.name ?? `AID ${base.externalId}`,
  };
}

function normaliseVms(raw: RawVmsDevice): InetDevice {
  const base = normaliseDms(raw);
  return {
    ...base,
    deviceId: packId("vms", base.externalId),
    subsystem: "vms",
    name: raw.name ?? `VMS ${base.externalId}`,
  };
}

function normaliseVsls(raw: RawVslsDevice): InetDevice {
  const base = normaliseDms(raw);
  // VSLS rows are lane-scoped in the source — surface the lane as a
  // suffix on the name so a gantry's three siblings render distinctly
  // in the objects list.
  const laneSuffix = raw.lane ? ` · ${raw.lane}` : "";
  return {
    ...base,
    deviceId: packId("vsls", base.externalId),
    subsystem: "vsls",
    name: raw.name ?? `VSLS ${base.externalId}${laneSuffix}`,
  };
}

function normaliseRadar(raw: RawRadarDevice): InetDevice {
  const externalId = raw.deviceId;
  return {
    deviceId: packId("radar", externalId),
    externalId,
    subsystem: "radar",
    type: raw.type ?? null,
    lat: raw.latitude ?? null,
    lng: raw.longitude ?? null,
    mileMarker: raw.mileMarker != null ? String(raw.mileMarker) : null,
    primaryRoad: raw.primaryRoad ?? null,
    crossRoad: raw.crossRoad ?? null,
    direction: raw.direction ?? null,
    routeId: raw.routeId != null ? String(raw.routeId) : null,
    agency: raw.agency ?? null,
    name: raw.name ?? `RADAR ${externalId}`,
    // Bearing is carried on `raw.bearing` — currently no `InetDevice`
    // column for it, so it stays available via the passthrough Zod
    // schema when downstream needs it (e.g. map icon rotation). No
    // media surface for a radar.
    media: null,
  };
}

/** Route each subsystem's raw JSON through its parser + normaliser.
 *  Returns null on parse failure so the caller can skip the row
 *  without aborting the page. Keeps `listLive` + `getEntity` free of
 *  a growing if/else chain per new subsystem. */
function parseAndNormalise(
  subsystem: InetSubsystem,
  raw: unknown,
): InetDevice | null {
  switch (subsystem) {
    case "cctv": {
      const parsed = RawCctvDeviceSchema.safeParse(raw);
      return parsed.success ? normaliseCctv(parsed.data) : null;
    }
    case "aid": {
      const parsed = RawAidDeviceSchema.safeParse(raw);
      return parsed.success ? normaliseAid(parsed.data) : null;
    }
    case "dms": {
      const parsed = RawDmsDeviceSchema.safeParse(raw);
      return parsed.success ? normaliseDms(parsed.data) : null;
    }
    case "vms": {
      const parsed = RawVmsDeviceSchema.safeParse(raw);
      return parsed.success ? normaliseVms(parsed.data) : null;
    }
    case "vsls": {
      const parsed = RawVslsDeviceSchema.safeParse(raw);
      return parsed.success ? normaliseVsls(parsed.data) : null;
    }
    case "radar": {
      const parsed = RawRadarDeviceSchema.safeParse(raw);
      return parsed.success ? normaliseRadar(parsed.data) : null;
    }
  }
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
    // Across-page de-dup: some iNET deployments ignore `start_id` and
    // keep returning the same payload. We bail when a page brings
    // nothing new, and hard-cap at MAX_PAGES regardless.
    const seenExternalIds = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page += 1) {
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
      let freshThisPage = 0;
      for (const entry of raw) {
        const device = parseAndNormalise(subsystem, entry);
        if (!device) continue;
        if (!seenExternalIds.has(device.externalId)) {
          seenExternalIds.add(device.externalId);
          freshThisPage += 1;
        }
        items.push(device);
      }
      const wasFullPage = raw.length === limit;
      const lastId = items[items.length - 1]?.externalId ?? null;
      const nextCursor =
        wasFullPage && freshThisPage > 0 && lastId ? lastId : null;
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
        return parseAndNormalise(unpacked.subsystem, raw);
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
          if (!unpacked || !STATUS_ENABLED_SUBSYSTEMS.has(unpacked.subsystem)) {
            return;
          }
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
