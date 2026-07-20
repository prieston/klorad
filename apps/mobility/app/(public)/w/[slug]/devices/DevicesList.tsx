"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { ChevronRight, Loader2, MapPin, Search, X } from "lucide-react";
import { subsystemDescriptor } from "@/lib/mobility/subsystem-icon";
import { DeviceLiveDetail } from "@/lib/mobility/DeviceLiveDetail";
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
 *
 * URL state (all shareable — restores on load):
 *   ?open=<deviceId>   — opens the detail sheet
 *   ?subsystem=<key>   — active filter chip
 *   ?q=<query>         — search box
 *
 * URL updates use `history.replaceState` (not Next router) so the
 * search box doesn't re-invoke the server page on every keystroke.
 */
export function DevicesList({ slug, devices }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Read initial state from URL exactly once — subsequent URL edits
  // go via history.replaceState so we don't re-derive.
  const initialRef = useRef<{
    open: string | null;
    subsystem: string;
    query: string;
  } | null>(null);
  if (initialRef.current === null) {
    initialRef.current = {
      open: searchParams?.get("open") ?? null,
      subsystem: searchParams?.get("subsystem") ?? "all",
      query: searchParams?.get("q") ?? "",
    };
  }

  const [query, setQuery] = useState(initialRef.current.query);
  const [subsystem, setSubsystem] = useState<string>(
    initialRef.current.subsystem,
  );
  const [openId, setOpenId] = useState<string | null>(initialRef.current.open);

  const writeUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (openId) params.set("open", openId);
    if (subsystem !== "all") params.set("subsystem", subsystem);
    if (query.trim()) params.set("q", query.trim());
    const q = params.toString();
    const url = q ? `${pathname}?${q}` : (pathname ?? "");
    window.history.replaceState(null, "", url);
  }, [openId, subsystem, query, pathname]);

  useEffect(() => {
    writeUrl();
  }, [writeUrl]);

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

      <div className="flex items-center gap-2 rounded-full border border-[var(--w-border-strong,#d4d4d8)] bg-[var(--w-surface,#ffffff)] pl-4">
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
        <ul className="divide-y divide-[var(--w-border,#e6e6ea)] rounded-2xl border border-[var(--w-border,#e6e6ea)] bg-[var(--w-surface,#ffffff)]">
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
          : "border-[var(--w-border,#e6e6ea)] bg-[var(--w-surface,#ffffff)] text-[var(--w-fg-muted,#6b6b6b)]"
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
  media?: {
    kind?: string;
    url?: string;
    streamType?: string;
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
        className="max-h-[calc(100dvh-4rem)] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-[var(--w-surface,#ffffff)] pb-[max(4.5rem,calc(3.5rem+env(safe-area-inset-bottom)))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
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
          {/* Explicit "fly to" affordance — navigates to the Map tab
              with `?device=<id>` so the map's URL-reactive select-
              and-fly effect takes over. Uses Next `Link` so nav is a
              soft push, preserving history + no full reload. */}
          <Link
            href={`/w/${slug}?device=${encodeURIComponent(device.id)}`}
            title="Fly to this device on the map"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--w-border,#e6e6ea)] px-2.5 py-1 text-[11px] font-medium text-[var(--w-fg,#1a1a1a)] transition-colors hover:border-[var(--w-accent,#0ea5e9)] hover:text-[var(--w-accent,#0ea5e9)]"
          >
            <MapPin size={11} strokeWidth={2} />
            Show on map
          </Link>
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
              No live data. The source returned no current status.
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

              <DeviceLiveDetail
                subsystem={device.subsystem}
                status={data.status.raw}
                media={data.media ?? null}
              />
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
