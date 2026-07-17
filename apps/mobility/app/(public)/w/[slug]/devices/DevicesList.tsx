"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Search, X, ChevronRight, Loader2 } from "lucide-react";
import { subsystemDescriptor } from "@/lib/mobility/subsystem-icon";
import type { PublicWorldDevice } from "@/lib/mobility/world-resolver";

interface Props {
  slug: string;
  devices: PublicWorldDevice[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

/**
 * Mobile list view of every device in the world. Subsystem chips
 * filter the list; tap a row to open a detail sheet with live
 * status. Same devices the map tab paints — this is the second
 * lens on the same data.
 *
 * The live-status fetch is on-demand (only when a row is tapped) so
 * the list itself is cheap. Follows the world's brand colour via
 * `--w-accent` inheritance.
 */
export function DevicesList({ slug, devices }: Props) {
  const [query, setQuery] = useState("");
  const [subsystem, setSubsystem] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const subsystems = useMemo(() => {
    const s = new Set<string>();
    devices.forEach((d) => s.add(d.subsystem));
    return Array.from(s).sort();
  }, [devices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (subsystem !== "all" && d.subsystem !== subsystem) return false;
      if (!q) return true;
      const hay =
        `${d.name} ${d.externalDeviceId} ${d.primaryRoad ?? ""} ${d.crossRoad ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [devices, subsystem, query]);

  const openedDevice = openId ? devices.find((d) => d.id === openId) : null;

  return (
    <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pb-32 pt-6 md:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--w-fg,#1a1a1a)]">
          Devices
        </h1>
        <p className="mt-1 text-sm text-[var(--w-fg-muted,#6b6b6b)]">
          {devices.length.toLocaleString()} device{devices.length === 1 ? "" : "s"} in this world. Tap a row for live status.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-full border border-[var(--w-border-strong,#d4d4d8)] bg-white pl-4">
        <Search size={14} className="text-[var(--w-fg-muted,#6b6b6b)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, id, road…"
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none placeholder:text-[var(--w-fg-muted,#6b6b6b)]"
        />
      </div>

      <div className="-mx-1 flex flex-wrap gap-1.5">
        <Chip active={subsystem === "all"} onClick={() => setSubsystem("all")}>
          All
        </Chip>
        {subsystems.map((s) => {
          const d = subsystemDescriptor(s);
          const Icon = d.icon;
          return (
            <Chip
              key={s}
              active={subsystem === s}
              onClick={() => setSubsystem(s)}
            >
              <Icon size={12} strokeWidth={2} />
              {d.label}
            </Chip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--w-fg-muted,#6b6b6b)]">
          No devices match this filter.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--w-border,#e6e6ea)] rounded-2xl border border-[var(--w-border,#e6e6ea)] bg-white">
          {filtered.map((d) => {
            const desc = subsystemDescriptor(d.subsystem);
            const Icon = desc.icon;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(d.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--w-page,#f5f5f7)]"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--w-page,#f5f5f7)]"
                  >
                    <Icon
                      size={14}
                      strokeWidth={2}
                      className="text-[var(--w-fg-muted,#6b6b6b)]"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--w-fg,#1a1a1a)]">
                      {d.name}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--w-fg-muted,#6b6b6b)]">
                      {desc.label} · {d.externalDeviceId}
                      {d.primaryRoad ? ` · ${d.primaryRoad}` : ""}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-[var(--w-fg-muted,#6b6b6b)]"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openedDevice && (
        <DetailSheet
          slug={slug}
          device={openedDevice}
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-transparent bg-[var(--w-accent,#0ea5e9)] text-[var(--w-accent-contrast,#ffffff)]"
          : "border-[var(--w-border,#e6e6ea)] bg-white text-[var(--w-fg-muted,#6b6b6b)]"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Detail sheet ──────────────────────────────────────────────────

interface LiveResponse {
  status: {
    online: boolean;
    alarm: string | null;
    observedAt: string;
    raw: Record<string, unknown>;
  } | null;
}

function DetailSheet({
  slug,
  device,
  onClose,
}: {
  slug: string;
  device: PublicWorldDevice;
  onClose: () => void;
}) {
  const { data, isLoading } = useSWR<LiveResponse>(
    `/api/public/worlds/${slug}/devices/${device.id}/live`,
    fetcher,
    { refreshInterval: 15_000 },
  );
  const desc = subsystemDescriptor(device.subsystem);
  const Icon = desc.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-t-3xl bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--w-border,#e6e6ea)]" />

        <header className="flex items-start gap-3 px-5 pt-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--w-page,#f5f5f7)]"
          >
            <Icon
              size={16}
              strokeWidth={2}
              className="text-[var(--w-fg-muted,#6b6b6b)]"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-[var(--w-fg,#1a1a1a)]">
              {device.name}
            </p>
            <p className="truncate text-xs text-[var(--w-fg-muted,#6b6b6b)]">
              {desc.label} · {device.externalDeviceId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--w-fg-muted,#6b6b6b)] hover:bg-[var(--w-page,#f5f5f7)]"
          >
            <X size={16} />
          </button>
        </header>

        <section className="px-5 pb-5 pt-4">
          {isLoading && !data ? (
            <p className="flex items-center gap-2 text-sm text-[var(--w-fg-muted,#6b6b6b)]">
              <Loader2 size={13} className="animate-spin" />
              Fetching live status…
            </p>
          ) : !data?.status ? (
            <p className="text-sm text-[var(--w-fg-muted,#6b6b6b)]">
              No live data — the source returned no current status.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${
                    data.status.online
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-red-500/10 text-red-700"
                  }`}
                >
                  {data.status.online ? "online" : "offline"}
                </span>
                {data.status.alarm && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {data.status.alarm}
                  </span>
                )}
                <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
                  {relativeFrom(data.status.observedAt)}
                </span>
              </div>

              <RawStatusList raw={data.status.raw} />
            </div>
          )}

          {device.primaryRoad && (
            <p className="mt-4 text-[11px] text-[var(--w-fg-muted,#6b6b6b)]">
              {device.primaryRoad}
              {device.direction ? ` · ${device.direction}` : ""}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function RawStatusList({ raw }: { raw: Record<string, unknown> }) {
  // Keep the sheet tight — surface only the small handful of fields
  // most stakeholders care about. Verbose radar per-lane / DMS
  // capability metadata stays in the drawer of the operator app.
  const KEYS = ["speed", "volume", "occupancy", "message", "eventCount"];
  const rows = KEYS.map((k) => [k, raw[k]] as const).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (rows.length === 0) {
    return (
      <p className="text-xs text-[var(--w-fg-muted,#6b6b6b)]">
        Connected. No live measurements to display.
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]">
            {k}
          </dt>
          <dd className="mt-0.5 font-mono text-sm text-[var(--w-fg,#1a1a1a)]">
            {typeof v === "number" && !Number.isInteger(v)
              ? v.toFixed(3)
              : String(v)}
          </dd>
        </div>
      ))}
    </dl>
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
