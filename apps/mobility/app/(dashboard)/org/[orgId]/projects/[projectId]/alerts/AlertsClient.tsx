"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldOff,
  WifiOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { subsystemIcon } from "@/lib/mobility/subsystem-icon";

// ─── Types (mirror the server response) ────────────────────────────

type AlertKind = "offline" | "alarmed";
type StateFilter = "open" | "acknowledged" | "closed" | "all";

interface AlertDevice {
  id: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  customLabel: string | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  agency: string | null;
}

interface AlertRow {
  id: string;
  kind: AlertKind;
  message: string;
  openedAt: string;
  closedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  device: AlertDevice;
}

interface AlertsResponse {
  state: StateFilter;
  alerts: AlertRow[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

// ─── Component ─────────────────────────────────────────────────────

export function AlertsClient({
  orgId,
  projectId,
  projectTitle,
}: {
  orgId: string;
  projectId: string;
  projectTitle: string;
}) {
  const [state, setState] = useState<StateFilter>("open");
  const { data, isLoading, mutate } = useSWR<AlertsResponse>(
    `/api/projects/${projectId}/alerts?state=${state}`,
    fetcher,
    { refreshInterval: 15_000 },
  );
  const alerts = useMemo(() => data?.alerts ?? [], [data]);

  const counts = useMemo(() => {
    // Only meaningful when the filter is `open`; in other filters we
    // don't have the full picture, so we skip the split.
    return {
      total: alerts.length,
      offline: alerts.filter((a) => a.kind === "offline").length,
      alarmed: alerts.filter((a) => a.kind === "alarmed").length,
    };
  }, [alerts]);

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
            Durable alert rows opened by the rule engine. Acknowledge to mark
            as seen; close when the underlying condition is resolved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/org/${orgId}/projects/${projectId}/alerts/rules`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Manage rules
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
          <Link
            href={`/org/${orgId}/projects/${projectId}/devices`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            <Database size={14} strokeWidth={1.8} aria-hidden />
            Devices
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatTile
          icon={Bell}
          label={state === "open" ? "Open" : state === "acknowledged" ? "Acknowledged" : state === "closed" ? "Closed" : "All"}
          value={counts.total}
          tone={counts.total > 0 && state === "open" ? "alarm" : "muted"}
        />
        <StatTile
          icon={WifiOff}
          label="Offline"
          value={counts.offline}
          tone={counts.offline > 0 && state === "open" ? "alarm" : "muted"}
        />
        <StatTile
          icon={ShieldOff}
          label="Alarmed"
          value={counts.alarmed}
          tone={counts.alarmed > 0 && state === "open" ? "alarm" : "muted"}
        />
      </section>

      {/* State filter + refresh tag */}
      <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line-soft bg-bg p-3">
        <ChipGroup
          value={state}
          options={[
            { value: "open", label: "Open" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "closed", label: "Closed" },
            { value: "all", label: "All" },
          ]}
          onChange={(v) => setState(v as StateFilter)}
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
      ) : alerts.length === 0 ? (
        <EmptyState state={state} orgId={orgId} projectId={projectId} />
      ) : (
        <SectionCard>
          <ul className="divide-y divide-line-soft">
            {alerts.map((a) => (
              <AlertItem
                key={a.id}
                alert={a}
                projectId={projectId}
                onChanged={() => void mutate()}
                openHref={`/org/${orgId}/projects/${projectId}?device=${a.device.id}`}
              />
            ))}
          </ul>
        </SectionCard>
      )}
    </main>
  );
}

// ─── Row ────────────────────────────────────────────────────────────

function AlertItem({
  alert,
  projectId,
  onChanged,
  openHref,
}: {
  alert: AlertRow;
  projectId: string;
  onChanged: () => void;
  openHref: string;
}) {
  const SubsystemIcon: LucideIcon = subsystemIcon(alert.device.subsystem);
  const KindIcon = alert.kind === "offline" ? WifiOff : ShieldOff;
  const [busy, setBusy] = useState(false);

  const isClosed = alert.closedAt !== null;
  const isAcked = alert.acknowledgedAt !== null && !isClosed;

  const patch = async (action: "ack" | "unack" | "close" | "reopen") => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/alerts/${alert.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) {
        toast.error("Update failed");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`grid items-center gap-3 px-5 py-4 md:grid-cols-[auto_1fr_auto_auto] md:gap-4 ${
        isClosed ? "opacity-60" : ""
      }`}
    >
      <span
        aria-hidden
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          isClosed
            ? "bg-surface-2 text-text-tertiary"
            : alert.kind === "offline"
              ? "bg-red-500/10 text-red-600"
              : "bg-yellow-500/10 text-yellow-600"
        }`}
      >
        <KindIcon size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <SubsystemIcon
            size={12}
            strokeWidth={1.8}
            className="text-text-tertiary"
            aria-hidden
          />
          <span className="truncate text-sm font-medium text-text-primary">
            {alert.device.customLabel ?? alert.device.name}
          </span>
          <KindPill kind={alert.kind} />
          {isClosed && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
              closed
            </span>
          )}
          {isAcked && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-emerald-600">
              acknowledged
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-tertiary">
          {alert.device.subsystem.toUpperCase()} · {alert.device.externalDeviceId}
          {alert.device.primaryRoad && ` · ${alert.device.primaryRoad}`}
          {alert.device.direction && ` (${alert.device.direction})`}
        </p>
        <p className="mt-1 text-xs text-text-secondary">{alert.message}</p>
        {alert.acknowledgedBy && (
          <p className="mt-0.5 text-[10px] text-text-tertiary">
            Acknowledged by{" "}
            {alert.acknowledgedBy.name ?? alert.acknowledgedBy.email ?? "unknown"}
            {alert.acknowledgedAt && ` · ${relativeFrom(alert.acknowledgedAt)}`}
          </p>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {relativeFrom(alert.openedAt)}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {isClosed ? (
          <button
            type="button"
            onClick={() => patch("reopen")}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <RotateCcw size={12} strokeWidth={1.8} />
            Reopen
          </button>
        ) : (
          <>
            {isAcked ? (
              <button
                type="button"
                onClick={() => patch("unack")}
                disabled={busy}
                aria-label="Unacknowledge"
                title="Unacknowledge"
                className="inline-flex items-center gap-1 rounded-md border border-line-soft px-2.5 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:border-text-primary hover:text-text-primary disabled:opacity-50"
              >
                <X size={12} strokeWidth={1.8} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => patch("ack")}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <Check size={12} strokeWidth={1.8} />
                Ack
              </button>
            )}
            <button
              type="button"
              onClick={() => patch("close")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : "Close"}
            </button>
          </>
        )}
        <Link
          href={openHref}
          className="inline-flex items-center gap-1 rounded-md border border-line-soft px-2.5 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:border-accent hover:text-accent"
        >
          <ArrowRight size={12} strokeWidth={1.8} />
        </Link>
      </div>
    </li>
  );
}

// ─── Empty state ────────────────────────────────────────────────────

function EmptyState({
  state,
  orgId,
  projectId,
}: {
  state: StateFilter;
  orgId: string;
  projectId: string;
}) {
  return (
    <SectionCard>
      <div className="px-6 py-16 text-center">
        <CheckCircle2
          size={32}
          strokeWidth={1.5}
          className="mx-auto text-emerald-500"
          aria-hidden
        />
        <h2 className="mt-4 text-lg font-medium text-text-primary">
          {state === "open"
            ? "No open alerts."
            : state === "acknowledged"
              ? "No acknowledged alerts."
              : state === "closed"
                ? "No closed alerts."
                : "No alerts have fired yet."}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Alerts are opened by rules matching upstream webhook events.{" "}
          <Link
            href={`/org/${orgId}/projects/${projectId}/alerts/rules`}
            className="text-accent hover:underline"
          >
            Create a rule
          </Link>{" "}
          to start.
        </p>
      </div>
    </SectionCard>
  );
}

// ─── Tiny shared primitives ───────────────────────────────────────

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

function KindPill({ kind }: { kind: AlertKind }) {
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
