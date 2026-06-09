"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import type { ConnectorDescriptor } from "@klorad/connectors";

interface SourceRow {
  id: string;
  connectorId: string;
  label: string;
  config: unknown;
  enabled: boolean;
  pollIntervalSeconds: number;
  lastSyncedAt: Date | string | null;
  lastError: string | null;
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
    { fallbackData: { sources: initialSources } },
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
        devicesSeen?: number;
        devicesInserted?: number;
        devicesUpdated?: number;
        error?: string;
      };
      if (res.ok) {
        toast.success(
          `Sync done: ${json.devicesSeen ?? 0} seen, ${
            json.devicesInserted ?? 0
          } new, ${json.devicesUpdated ?? 0} updated`,
        );
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
    <li className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
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
        </div>
        <p className="mt-1 text-xs text-text-tertiary">
          Last sync: {lastSyncedDisplay}
          {row.lastError && (
            <span className="ml-3 text-red-500">{row.lastError}</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={test}
          className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Test
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={sync}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          Sync now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="rounded-md border border-line-soft px-3 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
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
