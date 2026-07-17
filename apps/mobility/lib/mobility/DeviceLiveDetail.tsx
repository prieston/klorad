"use client";

import { DmsFace } from "@/lib/mobility/dms-render";

/**
 * Shared "rich live status" renderer for a mobility device — the
 * visitor-facing equivalent of the operator drawer's per-subsystem
 * tiles. Two callers today:
 *
 *   - `DevicesList` bottom sheet on `/w/<slug>/devices` (tap a row)
 *   - `WorldViewer` tap-a-pin panel on `/w/<slug>` (tap a marker)
 *
 * Per-subsystem breakdown of what shows:
 *   cctv / aid → HLS video (autoplay/loop/muted) when media.hlsUri
 *                is set; snapshot image when media.kind is
 *                cctv-snapshot; nothing otherwise
 *   dms / vms  → NTCIP MULTI face renderer + brightness/photocell
 *   vsls       → the lane's speed limit as a big number
 *   radar      → volume / mean speed / occupancy tile
 *   aid extras → eventCount + last-detection stamp
 *
 * Kept in `lib/mobility/` (not DS) because the DmsFace renderer + the
 * subsystem-tag → per-tile mapping are mobility-domain concerns;
 * porting them to the design system would require the DS to know
 * about ATMS device shapes, which is not the DS's job.
 */
export interface DeviceLiveDetailProps {
  subsystem: string;
  status: Record<string, unknown> | null;
  media?: {
    kind?: string;
    url?: string;
    streamType?: string;
  } | null;
}

export function DeviceLiveDetail({
  subsystem,
  status,
  media,
}: DeviceLiveDetailProps) {
  if (!status) {
    return (
      <p className="text-sm text-[var(--w-fg-muted,#6b6b6b)]">
        No live data — the source returned no current status.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Camera surfaces (CCTV + AID) — video first, then optional
          reachability caption. Native video element handles WebM +
          MP4; HLS via <video src> works on Safari, other browsers
          fall back to the placeholder. */}
      {(subsystem === "cctv" || subsystem === "aid") && (
        <CameraPanel media={media} />
      )}

      {/* NTCIP sign face — DMS / VMS render as a full message
          board, VSLS as a compact speed-limit tile. */}
      {(subsystem === "dms" || subsystem === "vms") &&
        typeof status.message === "string" && (
          <div className="rounded-xl border border-[var(--w-border,#e6e6ea)] bg-black p-3">
            <DmsFace
              multi={status.message}
              maxLinesPerPage={
                typeof status.maxLinesPerPage === "number"
                  ? status.maxLinesPerPage
                  : 3
              }
              maxCharsPerLine={
                typeof status.maxCharsPerLine === "number"
                  ? status.maxCharsPerLine
                  : 16
              }
              brightness={
                typeof (
                  status.brightnessLevel as { current?: number } | undefined
                )?.current === "number"
                  ? (status.brightnessLevel as { current: number }).current
                  : 100
              }
            />
          </div>
        )}

      {subsystem === "vsls" && (
        <VslsSpeedTile status={status} />
      )}

      {/* Radar telemetry — three-column readout. */}
      {subsystem === "radar" && <RadarTelemetryTile status={status} />}

      {/* AID event count + last-detection stamp. */}
      {subsystem === "aid" && <AidEventTile status={status} />}

      {/* DMS / VMS structured details (brightness, photocell, control
          mode). Renders below the face so the visitor sees the
          message first, the metadata second. */}
      {(subsystem === "dms" || subsystem === "vms") && (
        <SignDetails status={status} />
      )}
    </div>
  );
}

/* ─── Sub-tiles ────────────────────────────────────────────────────── */

function CameraPanel({
  media,
}: {
  media: DeviceLiveDetailProps["media"];
}) {
  if (media?.kind === "cctv-stream" && typeof media.url === "string") {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--w-border,#e6e6ea)] bg-black">
        <video
          src={media.url}
          controls
          playsInline
          autoPlay
          loop
          muted
          className="aspect-video w-full"
        />
      </div>
    );
  }
  if (media?.kind === "cctv-snapshot" && typeof media.url === "string") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={media.url}
        alt="Camera snapshot"
        className="w-full rounded-xl border border-[var(--w-border,#e6e6ea)]"
      />
    );
  }
  return (
    <div className="rounded-xl border border-[var(--w-border,#e6e6ea)] bg-[var(--w-page,#f5f5f7)] p-5 text-center text-xs text-[var(--w-fg-muted,#6b6b6b)]">
      No live stream or snapshot URL is configured for this camera.
    </div>
  );
}

function VslsSpeedTile({ status }: { status: Record<string, unknown> }) {
  // VSLS status is a single speed-limit number rendered as
  // `[pb]NN` MULTI + a `speedLimit` field the seed sets. Show the
  // big number if we can extract it.
  const speedLimit =
    typeof status.speedLimit === "number" ? status.speedLimit : null;
  const message =
    typeof status.message === "string" ? status.message : null;
  const extracted = message ? extractLeadingNumber(message) : null;
  const value = speedLimit ?? extracted;
  if (value === null) return null;
  return (
    <div className="rounded-xl border border-[var(--w-border,#e6e6ea)] bg-surface-2 p-4 text-center">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
        Lane speed limit
      </div>
      <div className="mt-2 font-mono text-5xl font-semibold text-[var(--w-fg,#1a1a1a)]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--w-fg-muted,#6b6b6b)]">
        km/h
      </div>
    </div>
  );
}

function extractLeadingNumber(multi: string): number | null {
  // MULTI can prefix control tags — [pb]80, [nl]…. Extract the first
  // continuous integer we find.
  const m = /(\d+)/.exec(multi);
  return m ? Number(m[1]) : null;
}

function RadarTelemetryTile({ status }: { status: Record<string, unknown> }) {
  const volume = typeof status.volume === "number" ? status.volume : null;
  const speed = typeof status.speed === "number" ? status.speed : null;
  const occupancy =
    typeof status.occupancy === "number" ? status.occupancy : null;
  if (volume === null && speed === null && occupancy === null) return null;

  return (
    <div className="rounded-xl border border-[var(--w-border,#e6e6ea)] bg-surface-2 p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
        Traffic sensor
      </div>
      <div className="grid grid-cols-3 gap-3">
        <RadarStat label="Volume" value={volume} unit="veh/min" />
        <RadarStat label="Speed" value={speed} unit="km/h" />
        <RadarStat
          label="Occupancy"
          value={occupancy !== null ? Math.round(occupancy * 100) : null}
          unit="%"
        />
      </div>
    </div>
  );
}

function RadarStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-[var(--w-fg,#1a1a1a)]">
          {value ?? "—"}
        </span>
        {value !== null && (
          <span className="text-[11px] text-[var(--w-fg-muted,#6b6b6b)]">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function AidEventTile({ status }: { status: Record<string, unknown> }) {
  const eventCount =
    typeof status.eventCount === "number" ? status.eventCount : null;
  const lastDetection =
    typeof status.lastDetection === "string" ? status.lastDetection : null;
  const message =
    typeof status.message === "string" ? status.message : null;
  if (eventCount === null && !lastDetection && !message) return null;
  return (
    <div className="rounded-xl border border-[var(--w-border,#e6e6ea)] bg-surface-2 p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
        Automated Incident Detection
      </div>
      <div className="flex items-baseline gap-3">
        {eventCount !== null && (
          <span className="text-2xl font-semibold text-[var(--w-fg,#1a1a1a)]">
            {eventCount}
          </span>
        )}
        {message && (
          <span className="text-sm text-[var(--w-fg-muted,#6b6b6b)]">
            {message}
          </span>
        )}
      </div>
      {lastDetection && (
        <div className="mt-2 text-[11px] text-[var(--w-fg-muted,#6b6b6b)]">
          Last detection · {relativeFrom(lastDetection)}
        </div>
      )}
    </div>
  );
}

function SignDetails({ status }: { status: Record<string, unknown> }) {
  const shortStatus =
    typeof status.shortStatus === "number" ? status.shortStatus : null;
  const controlMode =
    typeof status.controlMode === "string" ? status.controlMode : null;
  const beacon =
    typeof status.beacon === "boolean" ? status.beacon : null;
  const brightness = (status.brightnessLevel ?? null) as {
    current?: number;
    max?: number;
  } | null;
  const photocell = (status.photocellLevel ?? null) as {
    current?: number;
    max?: number;
  } | null;

  const rows: Array<[string, string]> = [];
  if (shortStatus !== null) {
    rows.push([
      "Fault",
      shortStatus === 0 ? "healthy" : `0x${shortStatus.toString(16)}`,
    ]);
  }
  if (controlMode) rows.push(["Mode", controlMode]);
  if (beacon !== null) rows.push(["Beacon", beacon ? "on" : "off"]);
  if (brightness?.current !== undefined && brightness.max !== undefined) {
    rows.push([
      "Brightness",
      `${brightness.current}/${brightness.max}`,
    ]);
  }
  if (photocell?.current !== undefined && photocell.max !== undefined) {
    rows.push([
      "Photocell",
      `${photocell.current}/${photocell.max}`,
    ]);
  }
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--w-border,#e6e6ea)] bg-surface-2 p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
        Sign details
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-[var(--w-fg-muted,#6b6b6b)]">{k}</dt>
            <dd className="font-mono text-[var(--w-fg,#1a1a1a)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function relativeFrom(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
