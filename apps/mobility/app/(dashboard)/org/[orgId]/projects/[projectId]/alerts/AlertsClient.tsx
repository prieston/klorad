"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  Database,
  RefreshCcw,
  ShieldOff,
  Signpost,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AlertRow {
  deviceId: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  customLabel: string | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  agency: string | null;
  kind: "offline" | "alarmed";
  message: string | null;
  observedAt: string;
}

interface AlertsResponse {
  alerts: AlertRow[];
  totalIncluded: number;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

type KindFilter = "all" | "offline" | "alarmed";

export function AlertsClient({
  orgId,
  projectId,
  projectTitle,
}: {
  orgId: string;
  projectId: string;
  projectTitle: string;
}) {
  const { data, isLoading } = useSWR<AlertsResponse>(
    `/api/projects/${projectId}/alerts`,
    fetcher,
    { refreshInterval: 15_000 },
  );
  const alerts = useMemo(() => data?.alerts ?? [], [data]);
  const total = data?.totalIncluded ?? 0;

  const [kind, setKind] = useState<KindFilter>("all");
  const filtered = useMemo(
    () => (kind === "all" ? alerts : alerts.filter((a) => a.kind === kind)),
    [alerts, kind],
  );

  const counts = useMemo(
    () => ({
      total: alerts.length,
      offline: alerts.filter((a) => a.kind === "offline").length,
      alarmed: alerts.filter((a) => a.kind === "alarmed").length,
    }),
    [alerts],
  );

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            {projectTitle}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Alerts.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Live feed of devices currently offline or carrying an alarm
            condition, derived from the ATMS status proxy. Scoped to your
            included fleet ({total.toLocaleString()} devices), refreshed
            every 15 seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/org/${orgId}/projects/${projectId}/devices`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            <Database size={14} strokeWidth={1.8} aria-hidden />
            Devices
          </Link>
          <Link
            href={`/org/${orgId}/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Open console
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatTile
          icon={Bell}
          label="Open alerts"
          value={counts.total}
          tone={counts.total > 0 ? "alarm" : "calm"}
        />
        <StatTile
          icon={WifiOff}
          label="Offline"
          value={counts.offline}
          tone={counts.offline > 0 ? "alarm" : "muted"}
        />
        <StatTile
          icon={ShieldOff}
          label="Alarmed"
          value={counts.alarmed}
          tone={counts.alarmed > 0 ? "alarm" : "muted"}
        />
      </section>

      {/* Filter chips + refresh tag */}
      <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line-soft bg-bg p-3">
        <ChipGroup
          value={kind}
          options={[
            { value: "all", label: "All open" },
            { value: "offline", label: "Offline", icon: WifiOff },
            { value: "alarmed", label: "Alarmed", icon: ShieldOff },
          ]}
          onChange={(v) => setKind(v as KindFilter)}
        />
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
          <RefreshCcw size={11} strokeWidth={1.8} aria-hidden />
          Auto-refresh 15 s
        </span>
      </section>

      {/* Feed */}
      {isLoading && alerts.length === 0 ? (
        <SectionCard>
          <p className="py-6 text-center text-sm text-text-tertiary">
            Loading…
          </p>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <div className="px-6 py-16 text-center">
            <CheckCircle2
              size={32}
              strokeWidth={1.5}
              className="mx-auto text-emerald-500"
              aria-hidden
            />
            <h2 className="mt-4 text-lg font-medium text-text-primary">
              {alerts.length === 0
                ? "Network is quiet."
                : "No alerts match this filter."}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {alerts.length === 0
                ? "All included devices are online and clear of alarms."
                : "Try All open."}
            </p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <ul className="divide-y divide-line-soft">
            {filtered.map((a) => (
              <AlertItem
                key={a.deviceId + a.observedAt}
                alert={a}
                openHref={`/org/${orgId}/projects/${projectId}?device=${a.deviceId}`}
              />
            ))}
          </ul>
        </SectionCard>
      )}
    </main>
  );
}

/* ─── Row ──────────────────────────────────────────────────────────── */

function AlertItem({
  alert,
  openHref,
}: {
  alert: AlertRow;
  openHref: string;
}) {
  const SubsystemIcon =
    alert.subsystem === "cctv"
      ? Camera
      : alert.subsystem === "dms"
        ? Signpost
        : AlertTriangle;
  const kindIcon = alert.kind === "offline" ? WifiOff : ShieldOff;
  const KindIcon = kindIcon;
  return (
    <li className="grid items-center gap-3 px-5 py-4 md:grid-cols-[auto_1fr_auto_auto] md:gap-4">
      <span
        aria-hidden
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          alert.kind === "offline"
            ? "bg-red-500/10 text-red-600"
            : "bg-yellow-500/10 text-yellow-600"
        }`}
      >
        <KindIcon size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <SubsystemIcon
            size={12}
            strokeWidth={1.8}
            className="text-text-tertiary"
            aria-hidden
          />
          <span className="truncate text-sm font-medium text-text-primary">
            {alert.customLabel ?? alert.name}
          </span>
          <KindPill kind={alert.kind} />
        </div>
        <p className="mt-0.5 truncate text-xs text-text-tertiary">
          {alert.subsystem.toUpperCase()} · {alert.externalDeviceId}
          {alert.primaryRoad && ` · ${alert.primaryRoad}`}
          {alert.direction && ` (${alert.direction})`}
          {alert.message && (
            <span className="text-text-secondary"> — {alert.message}</span>
          )}
        </p>
      </div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {relativeFrom(alert.observedAt)}
      </span>
      <Link
        href={openHref}
        className="inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
      >
        Open
        <ArrowRight size={12} strokeWidth={1.8} />
      </Link>
    </li>
  );
}

/* ─── Tiny shared primitives ───────────────────────────────────────── */

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line-soft bg-bg">
      {children}
    </section>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "alarm" | "calm" | "muted";
}) {
  const cls =
    tone === "alarm"
      ? "bg-red-500/10 text-red-600"
      : tone === "calm"
        ? "bg-emerald-500/10 text-emerald-600"
        : "bg-surface-2 text-text-tertiary";
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
          {label}
        </span>
        <span
          aria-hidden
          className={`flex h-8 w-8 items-center justify-center rounded-full ${cls}`}
        >
          <Icon size={14} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 text-3xl font-light text-text-primary">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-accent-contrast"
                : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            }`}
          >
            {Icon ? <Icon size={11} strokeWidth={1.8} aria-hidden /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function KindPill({ kind }: { kind: "offline" | "alarmed" }) {
  const cls =
    kind === "offline"
      ? "bg-red-500/10 text-red-600"
      : "bg-yellow-500/10 text-yellow-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] ${cls}`}
    >
      {kind}
    </span>
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
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
