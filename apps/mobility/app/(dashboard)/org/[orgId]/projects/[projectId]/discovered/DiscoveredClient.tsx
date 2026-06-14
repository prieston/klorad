"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Database,
  Eye,
  Inbox,
  Layers,
  RefreshCcw,
  Signpost,
  TrafficCone,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Device {
  id: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  type: string | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  agency: string | null;
  lat: number | null;
  lng: number | null;
  sourceId: string;
  createdAt: string;
  lastSeenAt: string;
}

interface Group {
  sourceId: string;
  label: string;
  connectorId: string;
  lastSyncedAt: string | null;
  devices: Device[];
}

interface DiscoveredResponse {
  groups: Group[];
  total: number;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

type Action = "include" | "public" | "reject";

export function DiscoveredClient({
  orgId,
  projectId,
  projectTitle,
}: {
  orgId: string;
  projectId: string;
  projectTitle: string;
}) {
  const { data, isLoading, mutate } = useSWR<DiscoveredResponse>(
    `/api/projects/${projectId}/discovered`,
    fetcher,
    { refreshInterval: 30_000 },
  );
  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;
  const [pending, setPending] = useState<Set<string>>(new Set());

  const act = async (deviceIds: string[], action: Action) => {
    if (deviceIds.length === 0) return;
    setPending((prev) => {
      const next = new Set(prev);
      for (const id of deviceIds) next.add(id);
      return next;
    });
    try {
      const res = await fetch(
        `/api/projects/${projectId}/devices/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceIds, action }),
        },
      );
      const body = (await res.json()) as {
        updated?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Update failed");
        return;
      }
      const verb =
        action === "include"
          ? "included"
          : action === "public"
            ? "published"
            : "rejected";
      toast.success(`${body.updated ?? deviceIds.length} devices ${verb}`);
      void mutate();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        for (const id of deviceIds) next.delete(id);
        return next;
      });
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            {projectTitle}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Discovered devices.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Every device the most recent sync surfaced that hasn&apos;t been
            triaged yet. Include each one for the operator console, push it
            straight to the traveller map, or reject it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/org/${orgId}/projects/${projectId}/sources`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCcw size={14} strokeWidth={1.8} aria-hidden />
            Sources
          </Link>
          <Link
            href={`/org/${orgId}/projects/${projectId}/devices`}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            All devices
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          icon={Inbox}
          label="Awaiting review"
          value={total}
          tone={total > 0 ? "warning" : "muted"}
        />
        <Stat icon={Database} label="Sources" value={groups.length} />
        <Stat
          icon={Layers}
          label="Largest batch"
          value={
            groups.length === 0
              ? 0
              : Math.max(...groups.map((g) => g.devices.length))
          }
        />
      </section>

      {isLoading && groups.length === 0 ? (
        <SectionCard>
          <p className="px-6 py-12 text-center text-sm text-text-tertiary">
            Loading…
          </p>
        </SectionCard>
      ) : groups.length === 0 ? (
        <SectionCard>
          <div className="px-6 py-16 text-center">
            <CheckCircle2
              size={32}
              strokeWidth={1.5}
              className="mx-auto text-emerald-500"
              aria-hidden
            />
            <h2 className="mt-4 text-lg font-medium text-text-primary">
              Inbox zero.
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              No devices waiting for review. Run a sync to surface new
              arrivals.
            </p>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <SourceGroup
              key={g.sourceId}
              group={g}
              orgId={orgId}
              projectId={projectId}
              pending={pending}
              onAct={act}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/* ─── Group ────────────────────────────────────────────────────────── */

function SourceGroup({
  group,
  orgId,
  projectId,
  pending,
  onAct,
}: {
  group: Group;
  orgId: string;
  projectId: string;
  pending: Set<string>;
  onAct: (deviceIds: string[], action: Action) => void;
}) {
  const ids = group.devices.map((d) => d.id);
  const busy = ids.some((id) => pending.has(id));
  return (
    <section className="overflow-hidden rounded-2xl border border-line-soft bg-bg">
      <header className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-surface-2 px-5 py-3">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <Database size={14} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <Link
            href={`/org/${orgId}/projects/${projectId}/sources`}
            className="truncate text-sm font-medium text-text-primary transition-colors hover:text-accent"
          >
            {group.label}
          </Link>
          <p className="text-[11px] text-text-tertiary">
            {group.connectorId}
            {group.lastSyncedAt &&
              ` · synced ${new Date(group.lastSyncedAt).toLocaleString()}`}
            {" · "}
            {group.devices.length} new
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(ids, "include")}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Eye size={12} strokeWidth={1.8} />
            Include all
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(ids, "reject")}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-bg px-3 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-50"
          >
            <XCircle size={12} strokeWidth={1.8} />
            Reject all
          </button>
        </div>
      </header>
      <ul className="divide-y divide-line-soft">
        {group.devices.map((d) => (
          <DeviceRow
            key={d.id}
            device={d}
            busy={pending.has(d.id)}
            onAct={(action) => onAct([d.id], action)}
          />
        ))}
      </ul>
    </section>
  );
}

function DeviceRow({
  device,
  busy,
  onAct,
}: {
  device: Device;
  busy: boolean;
  onAct: (action: Action) => void;
}) {
  const SubsystemIcon =
    device.subsystem === "cctv"
      ? Camera
      : device.subsystem === "dms"
        ? Signpost
        : TrafficCone;
  return (
    <li className="grid items-center gap-3 px-5 py-3 md:grid-cols-[auto_1fr_auto]">
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-text-secondary"
      >
        <SubsystemIcon size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {device.name}
          </span>
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-yellow-600">
            New
          </span>
        </div>
        <p className="truncate text-xs text-text-tertiary">
          {device.subsystem.toUpperCase()} · {device.externalDeviceId}
          {device.primaryRoad && ` · ${device.primaryRoad}`}
          {device.direction && ` (${device.direction})`}
          {device.agency && ` · ${device.agency}`}
          {device.lat == null && (
            <span className="ml-1 text-red-500">· no coords</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <RowAction
          disabled={busy}
          onClick={() => onAct("include")}
          icon={Eye}
          tone="primary"
          label="Include"
        />
        <RowAction
          disabled={busy}
          onClick={() => onAct("public")}
          icon={Eye}
          tone="success"
          label="Public"
        />
        <RowAction
          disabled={busy}
          onClick={() => onAct("reject")}
          icon={XCircle}
          tone="danger"
          label="Reject"
        />
      </div>
    </li>
  );
}

/* ─── Primitives ───────────────────────────────────────────────────── */

function RowAction({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  tone: "primary" | "success" | "danger";
  onClick: () => void;
  disabled?: boolean;
}) {
  const cls =
    tone === "primary"
      ? "border-line-strong text-text-primary hover:border-accent hover:text-accent"
      : tone === "success"
        ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
        : "border-line-soft text-text-tertiary hover:border-red-500 hover:text-red-500";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border bg-bg px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${cls}`}
    >
      <Icon size={11} strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line-soft bg-bg">
      {children}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "primary" | "warning" | "muted";
}) {
  const cls =
    tone === "warning"
      ? "bg-yellow-500/10 text-yellow-600"
      : tone === "muted"
        ? "bg-surface-2 text-text-tertiary"
        : "bg-accent-soft text-accent";
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
