"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import type { ConnectorDescriptor } from "@klorad/connectors";

interface SyncProgress {
  subsystem: string | null;
  page: number;
  seen: number;
  inserted: number;
  updated: number;
  message?: string;
}

interface SourceRow {
  id: string;
  connectorId: string;
  label: string;
  config: unknown;
  enabled: boolean;
  pollIntervalSeconds: number;
  lastSyncedAt: Date | string | null;
  lastError: string | null;
  syncStatus: string | null;
  syncStartedAt: string | null;
  syncProgress: SyncProgress | null;
}

interface Props {
  projectId: string;
  projectTitle: string;
  initialSources: SourceRow[];
  availableConnectors: ConnectorDescriptor[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

interface ListResponse {
  sources: SourceRow[];
}

/**
 * Data-sources screen — list of registered sources + a form to add
 * a new one. Per the brief, every source can declare its connector
 * + auth + subsystems + mode (fixture / live).
 *
 * Phase 1 is intentionally lean: only the iNET connector is
 * registered, only the fields it needs render. As more adapters land
 * the form widens; the registry-driven picker is what makes that
 * cheap.
 */
export function SourcesClient({
  projectId,
  projectTitle,
  initialSources,
  availableConnectors,
}: Props) {
  const { data, mutate } = useSWR<ListResponse>(
    `/api/projects/${projectId}/sources`,
    fetcher,
    {
      fallbackData: { sources: initialSources },
      // Bump poll cadence whenever a sync is in flight so the
      // progress card feels live; back off otherwise.
      refreshInterval: (latest) =>
        latest?.sources.some((s) => s.syncStatus === "running") ? 1500 : 0,
    },
  );
  const sources = data?.sources ?? initialSources;

  const [showForm, setShowForm] = useState(sources.length === 0);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {projectTitle}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Data sources
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          Declare an ATMS connection. The operator dashboard pulls live
          devices and status through each enabled source. Credentials are
          stored encrypted; live tests run server-side.
        </p>
      </header>

      <section className="mb-10">
        <div className="rounded-2xl border border-line-soft bg-bg p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-text-primary">
              Registered sources
            </h2>
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center justify-center rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
            >
              {showForm ? "Cancel" : "Add a source"}
            </button>
          </div>

          {sources.length === 0 ? (
            <p className="text-sm text-text-tertiary">
              No sources yet. Add one below to start pulling devices.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {sources.map((s) => (
                <SourceRowItem
                  key={s.id}
                  row={s}
                  onChanged={() => mutate()}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {showForm && (
        <AddSourceForm
          projectId={projectId}
          availableConnectors={availableConnectors}
          onAdded={() => {
            setShowForm(false);
            void mutate();
          }}
        />
      )}
    </main>
  );
}

function SourceRowItem({
  row,
  onChanged,
}: {
  row: SourceRow;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isRunning = row.syncStatus === "running";

  const test = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${row.id}/test`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) toast.success("Connection OK");
      else toast.error(json.error ?? "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${row.id}/sync`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        started?: boolean;
        reason?: string;
        error?: string;
      };
      if (res.ok) {
        if (json.started === false) {
          toast.info(json.reason ?? "Sync already running");
        } else {
          toast.success("Sync scheduled — progress below");
        }
        onChanged();
      } else {
        toast.error(json.error ?? "Sync failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete source "${row.label}"? This will drop its devices too.`))
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${row.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        onChanged();
      } else {
        toast.error("Delete failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const lastSyncedDisplay = row.lastSyncedAt
    ? new Date(row.lastSyncedAt).toLocaleString()
    : "never";

  return (
    <li className="py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-medium text-text-primary">
              {row.label}
            </span>
            <span className="text-xs text-text-tertiary">
              {row.connectorId}
            </span>
            {!row.enabled && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                Disabled
              </span>
            )}
            {row.syncStatus === "done" && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                Synced
              </span>
            )}
            {row.syncStatus === "failed" && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-red-600">
                Failed
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            Last sync: {lastSyncedDisplay}
            {row.lastError && !isRunning && (
              <span className="ml-3 text-red-500">{row.lastError}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || isRunning}
            onClick={test}
            className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Test
          </button>
          <button
            type="button"
            disabled={busy || isRunning}
            onClick={sync}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {isRunning ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            disabled={busy || isRunning}
            onClick={remove}
            className="rounded-md border border-line-soft px-3 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {isRunning && (
        <SyncProgressCard
          row={row}
          baseUrl={`https://demobe.parsonsinet.com/atms/${row.syncProgress?.subsystem ?? "{subsystem}"}-rest/rest/${row.syncProgress?.subsystem ?? "{subsystem}"}/`}
        />
      )}
    </li>
  );
}

/* ─── Live progress card ─────────────────────────────────────────── */

function SyncProgressCard({
  row,
  baseUrl,
}: {
  row: SourceRow;
  baseUrl: string;
}) {
  const startedAtMs = row.syncStartedAt
    ? Date.parse(row.syncStartedAt)
    : null;
  const elapsed = useMemo(() => {
    if (!startedAtMs) return null;
    const sec = Math.floor((Date.now() - startedAtMs) / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }, [startedAtMs, row.syncProgress?.page, row.syncProgress?.seen]);
  const p = row.syncProgress;
  // Indeterminate progress (no totalPages from the API) — animate a
  // pulsing accent bar to communicate liveness without lying about %.
  return (
    <div className="mt-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Syncing
        </span>
        {p?.subsystem && (
          <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text-secondary">
            {p.subsystem}
          </span>
        )}
        <span className="ml-auto text-[11px] text-text-tertiary">
          {elapsed ? `elapsed ${elapsed}` : "starting…"}
        </span>
      </div>

      {/* Indeterminate progress strip */}
      <div className="relative mb-3 h-1 w-full overflow-hidden rounded-full bg-bg/60">
        <div className="animate-[slide_1.4s_ease-in-out_infinite] absolute inset-y-0 w-1/3 rounded-full bg-accent/60" />
        <style>{`
          @keyframes slide {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}</style>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <Counter label="Pages" value={p?.page ?? 0} />
        <Counter label="Devices seen" value={p?.seen ?? 0} />
        <Counter label="New" value={p?.inserted ?? 0} tone="success" />
        <Counter label="Updated" value={p?.updated ?? 0} />
      </div>

      {p?.message && (
        <p className="mt-3 truncate text-[11px] text-text-secondary">
          {p.message}
        </p>
      )}

      <p className="mt-2 truncate font-mono text-[10px] text-text-tertiary">
        {baseUrl}
      </p>
    </div>
  );
}

function Counter({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number;
  tone?: "primary" | "success";
}) {
  const cls = tone === "success" ? "text-emerald-600" : "text-text-primary";
  return (
    <div className="rounded-md bg-bg/70 px-2.5 py-2">
      <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-base font-medium ${cls}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function AddSourceForm({
  projectId,
  availableConnectors,
  onAdded,
}: {
  projectId: string;
  availableConnectors: ConnectorDescriptor[];
  onAdded: () => void;
}) {
  const [connectorId, setConnectorId] = useState(
    availableConnectors[0]?.id ?? "",
  );
  const [label, setLabel] = useState("Demo ATMS");
  const [host, setHost] = useState("https://demobe.parsonsinet.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subCctv, setSubCctv] = useState(true);
  const [subDms, setSubDms] = useState(true);
  const [mode, setMode] = useState<"fixture" | "live">("fixture");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!connectorId) {
      toast.error("Pick a connector");
      return;
    }
    setSubmitting(true);
    try {
      const subsystems: string[] = [];
      if (subCctv) subsystems.push("cctv");
      if (subDms) subsystems.push("dms");
      const config: Record<string, unknown> = {
        host,
        subsystems,
        mode,
      };
      const credentials: Record<string, unknown> | null =
        mode === "live" ? { username, password } : null;
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId,
          label,
          config,
          credentials,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Create failed");
        return;
      }
      toast.success("Source added");
      onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line-soft bg-bg p-6">
      <h2 className="mb-4 text-lg font-medium text-text-primary">
        Add a data source
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-text-tertiary">Connector</span>
          <select
            value={connectorId}
            onChange={(e) => setConnectorId(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
          >
            {availableConnectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-tertiary">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-text-tertiary">Host</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="https://demobe.parsonsinet.com"
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-xs text-text-primary"
          />
        </label>
        <fieldset className="text-sm md:col-span-2">
          <legend className="mb-1 text-text-tertiary">Mode</legend>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 text-text-primary">
              <input
                type="radio"
                checked={mode === "fixture"}
                onChange={() => setMode("fixture")}
              />
              Fixture (seeded Thessaloniki data, no credentials)
            </label>
            <label className="inline-flex items-center gap-2 text-text-primary">
              <input
                type="radio"
                checked={mode === "live"}
                onChange={() => setMode("live")}
              />
              Live (use host + credentials)
            </label>
          </div>
        </fieldset>
        {mode === "live" && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
            </label>
          </>
        )}
        <fieldset className="text-sm md:col-span-2">
          <legend className="mb-1 text-text-tertiary">Subsystems</legend>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={subCctv}
                onChange={(e) => setSubCctv(e.target.checked)}
              />
              CCTV
            </label>
            <label className="inline-flex items-center gap-2 text-text-primary">
              <input
                type="checkbox"
                checked={subDms}
                onChange={(e) => setSubDms(e.target.checked)}
              />
              DMS
            </label>
          </div>
        </fieldset>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save source"}
        </button>
      </div>
    </section>
  );
}
