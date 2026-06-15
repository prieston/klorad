"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Brush, Check } from "lucide-react";
import { getStockIcon } from "@/lib/mobility/device-icons";

interface StyleRow {
  subsystem: string;
  iconKey: string;
  isOverride: boolean;
}

interface IconChoice {
  key: string;
  label: string;
  description: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
  initialStyles: StyleRow[];
  iconLibrary: IconChoice[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

export function StylesClient({
  projectId,
  projectTitle,
  initialStyles,
  iconLibrary,
}: Props) {
  const { data, mutate } = useSWR<{ styles: StyleRow[] }>(
    `/api/projects/${projectId}/styles`,
    fetcher,
    { fallbackData: { styles: initialStyles } },
  );
  const baseline = data?.styles ?? initialStyles;

  const [draft, setDraft] = useState<Map<string, string>>(
    () => new Map(baseline.map((s) => [s.subsystem, s.iconKey])),
  );
  const [saving, setSaving] = useState(false);

  // Re-sync the draft when the server data shifts under us (after a
  // save mutate, for instance). Keep the operator's in-progress edits
  // if any draft key already differs.
  const hash = baseline
    .map((s) => `${s.subsystem}:${s.iconKey}`)
    .join("|");
  useMemo(() => {
    setDraft((prev) => {
      const next = new Map(prev);
      for (const s of baseline) {
        if (!prev.has(s.subsystem)) next.set(s.subsystem, s.iconKey);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const dirty = baseline.some(
    (s) => (draft.get(s.subsystem) ?? s.iconKey) !== s.iconKey,
  );

  async function save() {
    setSaving(true);
    try {
      const styles = Array.from(draft.entries()).map(([subsystem, iconKey]) => ({
        subsystem,
        iconKey,
      }));
      const res = await fetch(`/api/projects/${projectId}/styles`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ styles }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to save");
      }
      toast.success("Device styles saved");
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
            {projectTitle}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-text-primary">
            <Brush size={20} strokeWidth={1.7} aria-hidden />
            Device styles
          </h1>
          <p className="mt-2 max-w-[640px] text-sm text-text-secondary">
            Pick an icon for each device class so the map reads at a
            glance — cameras, signs, weather stations, sensors are all
            recognisable from a single zoom-out.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save styles"}
        </button>
      </header>

      {baseline.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-4">
          {baseline.map((row) => (
            <li key={row.subsystem}>
              <SubsystemCard
                subsystem={row.subsystem}
                value={draft.get(row.subsystem) ?? row.iconKey}
                isOverride={row.isOverride}
                iconLibrary={iconLibrary}
                onChange={(next) =>
                  setDraft((prev) => {
                    const map = new Map(prev);
                    map.set(row.subsystem, next);
                    return map;
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-soft bg-surface-1/30 py-16 text-center">
      <Brush size={26} strokeWidth={1.4} className="text-text-tertiary" />
      <p className="text-sm font-medium text-text-primary">
        No subsystems detected
      </p>
      <p className="max-w-[420px] text-xs text-text-secondary">
        Sync a data source first — device subsystems (CCTV, DMS,
        sensor, …) appear here as soon as the project has any devices
        to style.
      </p>
    </div>
  );
}

function SubsystemCard({
  subsystem,
  value,
  isOverride,
  iconLibrary,
  onChange,
}: {
  subsystem: string;
  value: string;
  isOverride: boolean;
  iconLibrary: IconChoice[];
  onChange: (next: string) => void;
}) {
  const selected = getStockIcon(value);
  return (
    <article className="rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selected ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <selected.Icon size={20} strokeWidth={1.6} aria-hidden />
            </span>
          ) : null}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              Subsystem
            </p>
            <h2 className="text-sm font-semibold text-text-primary">
              {subsystem.toUpperCase()}
            </h2>
          </div>
        </div>
        {!isOverride ? (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            Default
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {iconLibrary.map((choice) => {
          const stock = getStockIcon(choice.key);
          if (!stock) return null;
          const active = value === choice.key;
          return (
            <button
              key={choice.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(choice.key)}
              className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line-soft bg-bg hover:border-line-strong"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-accent text-accent-contrast" : "bg-surface-2 text-text-secondary"
                }`}
              >
                <stock.Icon size={16} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={`block truncate text-xs font-semibold ${
                    active ? "text-text-primary" : "text-text-primary"
                  }`}
                >
                  {choice.label}
                </span>
                <span className="block truncate text-[10px] text-text-tertiary">
                  {choice.description}
                </span>
              </span>
              {active ? (
                <Check
                  size={14}
                  strokeWidth={2.2}
                  className="shrink-0 text-accent"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}
