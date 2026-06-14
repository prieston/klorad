"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Compass,
  Database,
  Eye,
  Globe2,
  Layers,
  ListTodo,
  RefreshCcw,
  ShieldCheck,
  TrafficCone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

interface Counters {
  projectCount: number;
  publishedCount: number;
  sourceCount: number;
  deviceCount: number;
  publicCount: number;
  needsReviewCount: number;
  openAlertCount: number;
}

interface RecentSync {
  id: string;
  label: string;
  connectorId: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  project: { id: string; title: string };
}

interface OverviewResponse {
  counters: Counters;
  recentSyncs: RecentSync[];
}

export function OverviewClient({
  orgId,
  orgName,
}: {
  orgId: string;
  orgName: string;
}) {
  const { data, isLoading } = useSWR<OverviewResponse>(
    `/api/orgs/${orgId}/overview`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const c = data?.counters;
  const syncs = data?.recentSyncs ?? [];

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10">
      {/* Hero */}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {orgName}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Operations overview.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Every project, every device, every alert across your traffic
            network. Snapshot updates every 30 seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/org/${orgId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            <Building2 size={14} strokeWidth={1.8} aria-hidden />
            Projects
          </Link>
          <Link
            href={`/org/${orgId}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            New project
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
        </div>
      </header>

      {/* Hero stats grid */}
      <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          eyebrow="Projects"
          value={c?.projectCount}
          loading={isLoading}
          accent="primary"
          hint={
            c
              ? `${c.publishedCount} published · ${c.projectCount - c.publishedCount} draft`
              : null
          }
        />
        <StatCard
          icon={Database}
          eyebrow="Data sources"
          value={c?.sourceCount}
          loading={isLoading}
          accent="primary"
          hint="ATMS, IoT, RSS feeds"
        />
        <StatCard
          icon={Layers}
          eyebrow="Devices in network"
          value={c?.deviceCount}
          loading={isLoading}
          accent="primary"
          hint={c ? `${c.publicCount} on traveller map` : null}
        />
        <StatCard
          icon={AlertTriangle}
          eyebrow="Open alerts"
          value={c?.openAlertCount}
          loading={isLoading}
          accent={c && c.openAlertCount > 0 ? "alarm" : "muted"}
          hint={
            c && c.openAlertCount > 0
              ? "Acknowledge in operator console"
              : "Network is quiet"
          }
        />
      </section>

      {/* Secondary tiles */}
      <section className="mb-10 grid gap-4 md:grid-cols-3">
        <PromoTile
          icon={TrafficCone}
          title="Needs review"
          body={
            c?.needsReviewCount === 0
              ? "No new devices waiting for curation."
              : `${c?.needsReviewCount ?? "—"} devices arrived in your latest sync and haven't been reviewed yet.`
          }
          href={`/org/${orgId}`}
          cta="Open a project"
        />
        <PromoTile
          icon={Eye}
          title="Traveller map"
          body={
            c?.publicCount === 0
              ? "No devices are public yet. Flip Include + Public on the ones you want commuters to see."
              : `${c?.publicCount ?? "—"} devices visible to anonymous commuters.`
          }
          href={`/org/${orgId}`}
          cta="Curate"
        />
        <PromoTile
          icon={ShieldCheck}
          title="Coverage"
          body={
            c && c.deviceCount > 0
              ? `${Math.round((c.publicCount / c.deviceCount) * 100)}% of devices are on the public map. Lift Include flags to grow your live network reach.`
              : "Add a data source to start populating your network."
          }
          href={`/org/${orgId}`}
          cta="Manage sources"
        />
      </section>

      {/* Recent syncs */}
      <section className="rounded-2xl border border-line-soft bg-bg p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-text-primary">
            Recent syncs
          </h2>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            <RefreshCcw size={11} strokeWidth={1.8} aria-hidden />
            Auto-refresh
          </span>
        </div>
        {syncs.length === 0 ? (
          <p className="py-6 text-sm text-text-tertiary">
            No syncs yet. Open a project, configure a data source, click Sync
            now.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {syncs.map((s) => (
              <li
                key={s.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {s.label}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {s.connectorId}
                    </span>
                    {s.lastError && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-red-600">
                        Last attempt failed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-text-tertiary">
                    {s.project.title} ·{" "}
                    {s.lastSyncedAt
                      ? new Date(s.lastSyncedAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <Link
                  href={`/org/${orgId}/projects/${s.project.id}/sources`}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  Open source
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  eyebrow,
  value,
  hint,
  loading,
  accent,
}: {
  icon: LucideIcon;
  eyebrow: string;
  value: number | undefined;
  hint?: string | null;
  loading: boolean;
  accent: "primary" | "alarm" | "muted";
}) {
  const accentClass =
    accent === "alarm"
      ? "bg-red-500/10 text-red-600"
      : accent === "muted"
        ? "bg-surface-2 text-text-tertiary"
        : "bg-accent-soft text-accent";
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
          {eyebrow}
        </span>
        <span
          aria-hidden
          className={`flex h-8 w-8 items-center justify-center rounded-full ${accentClass}`}
        >
          <Icon size={14} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-4 text-3xl font-light text-text-primary md:text-4xl">
        {loading || value === undefined ? "—" : value.toLocaleString()}
      </div>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PromoTile({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line-soft bg-bg p-5">
      <span
        aria-hidden
        className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"
      >
        <Icon size={14} strokeWidth={1.8} />
      </span>
      <h3 className="text-base font-medium text-text-primary">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-text-secondary">
        {body}
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 self-start text-xs font-medium text-accent transition-colors hover:text-accent-hover"
      >
        {cta}
        <Globe2 size={12} strokeWidth={1.8} aria-hidden />
      </Link>
    </div>
  );
}

// Suppress an unused-import warning if some icons are imported for future
// use but not referenced in this file yet.
export const _unused: { Compass: LucideIcon; ListTodo: LucideIcon } = {
  Compass,
  ListTodo,
};
