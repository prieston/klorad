"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  RefreshCcw,
  Search,
  TrafficCone,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { INET_SUBSYSTEMS } from "@klorad/connectors/inet-atms";
import {
  subsystemDescriptor,
  subsystemIcon,
} from "@/lib/mobility/subsystem-icon";

interface DeviceRow {
  id: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  type: string | null;
  lat: number | null;
  lng: number | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  agency: string | null;
  included: boolean;
  isPublic: boolean;
  customLabel: string | null;
  needsReview: boolean;
  sourceId: string;
  lastSeenAt: string;
}

interface DevicesResponse {
  devices: DeviceRow[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

type StatusFilter = "all" | "needs-review" | "included" | "public" | "catalog";
// Kept as a wide `string` so the picker survives future additions to
// `INET_SUBSYSTEMS` without a code change here — the filter chip row
// is generated from that enum below.
type SubsystemFilter = "all" | string;

export function DevicesClient({
  orgId,
  projectId,
  projectTitle,
}: {
  orgId: string;
  projectId: string;
  projectTitle: string;
}) {
  const { data, isLoading, mutate } = useSWR<DevicesResponse>(
    `/api/projects/${projectId}/devices`,
    fetcher,
    { refreshInterval: 30_000 },
  );
  const devices = useMemo(() => data?.devices ?? [], [data]);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [subsystem, setSubsystem] = useState<SubsystemFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (subsystem !== "all" && d.subsystem !== subsystem) return false;
      if (status === "needs-review" && !d.needsReview) return false;
      if (status === "included" && !d.included) return false;
      if (status === "public" && !d.isPublic) return false;
      if (status === "catalog" && (d.included || d.isPublic)) return false;
      if (q) {
        const hay = [
          d.name,
          d.customLabel ?? "",
          d.externalDeviceId,
          d.primaryRoad ?? "",
          d.crossRoad ?? "",
          d.agency ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devices, status, subsystem, query]);

  const counts = useMemo(() => {
    return {
      total: devices.length,
      needsReview: devices.filter((d) => d.needsReview).length,
      included: devices.filter((d) => d.included).length,
      isPublic: devices.filter((d) => d.isPublic).length,
    };
  }, [devices]);

  const allOnPageSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.id));

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const d of filtered) next.delete(d.id);
      } else {
        for (const d of filtered) next.add(d.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulk = async (
    action:
      | "include"
      | "exclude"
      | "public"
      | "private"
      | "reviewed"
      | "unreviewed",
  ) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/devices/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceIds: Array.from(selected),
          action,
        }),
      });
      const body = (await res.json()) as { updated?: number; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Bulk update failed");
        return;
      }
      toast.success(`${body.updated ?? selected.size} devices updated`);
      clearSelection();
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-10 md:px-10">
      {/* Header */}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            {projectTitle}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Devices.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Every device in the catalog. Curate which ones the operator team
            sees and which reach the public traveller map. Multi-select rows
            to act on hundreds at once.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/org/${orgId}/projects/${projectId}/sources`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCcw size={14} strokeWidth={1.8} aria-hidden />
            Sync sources
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

      {/* Stat tiles */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Layers} label="Total devices" value={counts.total} />
        <StatTile
          icon={TrafficCone}
          label="Needs review"
          value={counts.needsReview}
          tone={counts.needsReview > 0 ? "warning" : "muted"}
        />
        <StatTile
          icon={Eye}
          label="In operator console"
          value={counts.included}
        />
        <StatTile
          icon={Eye}
          label="On traveller map"
          value={counts.isPublic}
          tone="success"
        />
      </section>

      {/* Filters */}
      <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line-soft bg-bg p-3">
        <ChipGroup
          value={subsystem}
          options={[
            { value: "all", label: "All types" },
            // Emit one chip per connector-known subsystem so the
            // demo enums (aid / vms / vsls / radar) surface without
            // touching this file.
            ...INET_SUBSYSTEMS.map((s) => {
              const d = subsystemDescriptor(s);
              return { value: s, label: d.label, icon: d.icon };
            }),
          ]}
          onChange={(v) => setSubsystem(v as SubsystemFilter)}
        />
        <span className="hidden h-5 w-px bg-line-soft md:block" />
        <ChipGroup
          value={status}
          options={[
            { value: "all", label: "All status" },
            { value: "needs-review", label: "Needs review" },
            { value: "included", label: "Included" },
            { value: "public", label: "Public" },
            { value: "catalog", label: "Catalog only" },
          ]}
          onChange={(v) => setStatus(v as StatusFilter)}
        />
        <div className="ml-auto flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-line-soft bg-bg pl-3">
          <Search size={14} strokeWidth={1.8} className="text-text-tertiary" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, id, road, agency…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </section>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
          <span className="font-medium text-accent">
            {selected.size} selected
          </span>
          <span className="ml-2 hidden h-4 w-px bg-accent/30 md:block" />
          <BulkButton onClick={() => bulk("include")} icon={Eye}>
            Include
          </BulkButton>
          <BulkButton onClick={() => bulk("public")} icon={Eye}>
            Make public
          </BulkButton>
          <BulkButton onClick={() => bulk("reviewed")} icon={CheckCircle2}>
            Mark reviewed
          </BulkButton>
          <BulkButton onClick={() => bulk("private")} icon={EyeOff}>
            Make private
          </BulkButton>
          <BulkButton onClick={() => bulk("exclude")} icon={EyeOff}>
            Exclude
          </BulkButton>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
          >
            <X size={12} strokeWidth={1.8} />
            Clear
          </button>
        </section>
      )}

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-line-soft bg-bg">
        <div className="flex items-center gap-3 border-b border-line-soft bg-surface-2 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleAllOnPage}
              className="cursor-pointer"
            />
          </label>
          <span className="flex-1">Device</span>
          <span className="hidden w-[230px] md:block">Road locator</span>
          <span className="hidden w-[180px] md:block">Curation</span>
          <span className="w-16 text-right">Open</span>
        </div>

        {isLoading && devices.length === 0 ? (
          <div className="p-12 text-center text-sm text-text-tertiary">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Layers
              size={28}
              strokeWidth={1.6}
              className="mx-auto text-text-tertiary"
              aria-hidden
            />
            <p className="mt-3 text-sm text-text-tertiary">
              {devices.length === 0
                ? "No devices yet. Sync a source to populate this list."
                : "No devices match these filters."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {filtered.map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                orgId={orgId}
                projectId={projectId}
                selected={selected.has(d.id)}
                onToggle={() => toggleRow(d.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/* ─── Row ──────────────────────────────────────────────────────────── */

function DeviceRow({
  device,
  orgId,
  projectId,
  selected,
  onToggle,
}: {
  device: DeviceRow;
  orgId: string;
  projectId: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const SubsystemIcon: LucideIcon = subsystemIcon(device.subsystem);
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        selected ? "bg-accent-soft/40" : "hover:bg-surface-2/40"
      }`}
    >
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="cursor-pointer"
        />
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-secondary"
        >
          <SubsystemIcon size={14} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary">
              {device.customLabel ?? device.name}
            </span>
            {device.needsReview && (
              <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-yellow-600">
                New
              </span>
            )}
          </div>
          <p className="truncate text-xs text-text-tertiary">
            {device.subsystem.toUpperCase()} · {device.externalDeviceId}
            {device.agency && ` · ${device.agency}`}
          </p>
        </div>
      </div>
      <div className="hidden w-[230px] min-w-0 text-xs text-text-secondary md:block">
        {device.primaryRoad ? (
          <span className="truncate">
            {device.primaryRoad}
            {device.crossRoad && (
              <span className="text-text-tertiary"> × {device.crossRoad}</span>
            )}
            {device.direction && (
              <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-text-tertiary">
                {device.direction}
              </span>
            )}
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </div>
      <div className="hidden w-[180px] items-center gap-1.5 md:flex">
        {device.isPublic ? (
          <CurationPill tone="public">Public</CurationPill>
        ) : device.included ? (
          <CurationPill tone="included">Included</CurationPill>
        ) : (
          <CurationPill tone="catalog">Catalog</CurationPill>
        )}
      </div>
      <Link
        href={`/org/${orgId}/projects/${projectId}?device=${device.id}`}
        className="inline-flex h-7 w-16 items-center justify-end gap-1 text-xs font-medium text-accent hover:text-accent-hover"
      >
        Open
        <ArrowRight size={12} strokeWidth={1.8} />
      </Link>
    </li>
  );
}

/* ─── Tiny shared primitives ───────────────────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "primary" | "warning" | "success" | "muted";
}) {
  const dotClass =
    tone === "warning"
      ? "bg-yellow-500/10 text-yellow-600"
      : tone === "success"
        ? "bg-emerald-500/10 text-emerald-600"
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
          className={`flex h-8 w-8 items-center justify-center rounded-full ${dotClass}`}
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

function CurationPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "public" | "included" | "catalog";
}) {
  const cls =
    tone === "public"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "included"
        ? "bg-blue-500/10 text-blue-600"
        : "bg-surface-2 text-text-tertiary";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${cls}`}
    >
      {children}
    </span>
  );
}

function BulkButton({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-bg px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg/80"
    >
      <Icon size={12} strokeWidth={1.8} />
      {children}
    </button>
  );
}
