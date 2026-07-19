/**
 * VDS traffic simulator — the Scenario 3 side. `snapshot()` returns
 * the latest sample per active radar; `startTicker()` runs a 1 Hz
 * loop that emits `vds.tick` events over the bus.
 *
 * Realism: rush hour (07:30-09:30, 17:00-19:00) doubles volume + drops
 * mean speed; otherwise steady flow with jitter.
 */
import type { Device, VdsSample } from "./types";
import { allDevices } from "./devices";
import { publish } from "./events";

const latest: Map<string, VdsSample> = new Map();

let ticker: NodeJS.Timeout | null = null;
let slowdownExternalId: string | null = null;
let slowdownUntil = 0;

export function snapshot(): VdsSample[] {
  return Array.from(latest.values());
}

/** Start (or restart) the 1 Hz tick loop. Idempotent. */
export function startTicker(): void {
  if (ticker) return;
  const radars = allDevices().filter(
    (d) => d.subsystem === "radar" && Number.isFinite(d.latitude),
  );
  ticker = setInterval(() => tickOnce(radars), 1000);
}

export function stopTicker(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
  slowdownExternalId = null;
  slowdownUntil = 0;
}

/** Whether the VDS ticker is currently running. Powers the demo-
 *  panel's "Traffic ticker: active" badge. */
export function tickerRunning(): boolean {
  return ticker !== null;
}

/** Trigger a scripted 30-second slowdown on one radar — Scenario 3
 *  demonstrates how a downstream incident propagates through the
 *  traffic-management chain. */
export function triggerSlowdown(externalId?: string): string | null {
  const target =
    externalId ??
    (() => {
      const radars = allDevices().filter((d) => d.subsystem === "radar");
      return radars[Math.floor(Math.random() * radars.length)]?.externalId;
    })();
  if (!target) return null;
  slowdownExternalId = target;
  slowdownUntil = Date.now() + 30_000;
  return target;
}

function tickOnce(radars: Device[]): void {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const rush = isRushHour(now);
  for (const r of radars) {
    const inSlowdown =
      slowdownExternalId === r.externalId && now < slowdownUntil;
    const baseVolume = rush ? 90 : 40; // veh/min
    const baseSpeed = inSlowdown ? 25 : rush ? 65 : 95; // km/h
    const jitter = () => (Math.random() - 0.5) * 2;
    const volume = Math.max(
      0,
      Math.round(baseVolume + jitter() * 15 + (inSlowdown ? -25 : 0)),
    );
    const speed = Math.max(
      5,
      Math.round(baseSpeed + jitter() * 8),
    );
    const occupancy = Math.min(
      1,
      Math.max(0, volume / 120 + jitter() * 0.05),
    );
    const sample: VdsSample = {
      deviceId: r.externalId,
      timestamp: iso,
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
    latest.set(r.externalId, sample);
    publish({ type: "vds.tick", at: iso, payload: sample });
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
