"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Bell,
  FlaskConical,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

// ─── Types (mirror what the server returns) ────────────────────────

type RuleKind = "threshold" | "event";
type ThresholdOp = "gt" | "gte" | "lt" | "lte" | "eq";
type UpstreamEventType =
  | "device.status_changed"
  | "incident.posted"
  | "incident.status_changed"
  | "vds.tick";

interface RuleRow {
  id: string;
  name: string;
  sourceId: string | null;
  enabled: boolean;
  kind: RuleKind;
  config: unknown;
  targets: { worldIds?: string[] } | null;
  createdAt: string;
}

interface ListResponse {
  rules: RuleRow[];
}

interface WorldRow {
  id: string;
  slug: string;
  name: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const SUBSYSTEMS = ["radar", "dms", "vsls", "aid", "cctv"] as const;

/** Numeric fields the operator can pick per subsystem for a threshold
 *  rule. Matches what the mock emits on `device.status_changed`; other
 *  fields the raw shape exposes just won't fire but that's fine. */
const FIELDS_BY_SUBSYSTEM: Record<string, string[]> = {
  radar: ["occupancy", "speed", "volume"],
  dms: ["shortStatus", "brightness"],
  vsls: ["speedLimit"],
  aid: ["eventCount"],
  cctv: ["connectable"],
};

const OP_LABELS: Record<ThresholdOp, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
};

const EVENT_TYPES: UpstreamEventType[] = [
  "device.status_changed",
  "incident.posted",
  "incident.status_changed",
];

// ─── Component ─────────────────────────────────────────────────────

export function RulesClient({
  orgId,
  projectId,
  projectTitle,
}: {
  orgId: string;
  projectId: string;
  projectTitle: string;
}) {
  const { data, mutate, isLoading } = useSWR<ListResponse>(
    `/api/projects/${projectId}/alert-rules`,
    fetcher,
  );
  const { data: worldsData } = useSWR<{ worlds: WorldRow[] }>(
    `/api/worlds?projectId=${projectId}`,
    fetcher,
  );
  const worlds = worldsData?.worlds ?? [];
  const rules = data?.rules ?? [];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <Link
          href={`/org/${orgId}/projects/${projectId}/alerts`}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary hover:text-text-primary"
        >
          <ArrowLeft size={12} />
          {projectTitle} · Alerts
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-light text-text-primary">
          <Bell size={20} strokeWidth={1.5} className="text-accent" />
          Alert rules
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Rules turn upstream webhook events into <code>MobilityAlert</code>{" "}
          rows. Each rule can push a notification to a set of world
          subscribers when it fires — same delivery pipeline as manual
          broadcasts.
        </p>
      </header>

      <RuleForm
        projectId={projectId}
        worlds={worlds}
        onCreated={() => void mutate()}
      />

      <section className="mt-8 rounded-2xl border border-line-soft bg-bg">
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="text-lg font-medium text-text-primary">
            All rules ({rules.length})
          </h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-text-tertiary">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="px-6 py-8 text-sm text-text-tertiary">
            No rules yet. Create one above.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {rules.map((r) => (
              <RuleRowItem
                key={r.id}
                rule={r}
                worlds={worlds}
                projectId={projectId}
                onChanged={() => void mutate()}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// ─── Row ────────────────────────────────────────────────────────────

function RuleRowItem({
  rule,
  worlds,
  projectId,
  onChanged,
}: {
  rule: RuleRow;
  worlds: WorldRow[];
  projectId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const worldName = (id: string) =>
    worlds.find((w) => w.id === id)?.name ?? `world:${id.slice(0, 6)}`;

  const summary = summariseRule(rule);
  const worldIds = rule.targets?.worldIds ?? [];

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/alert-rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !rule.enabled }),
        },
      );
      if (!res.ok) {
        toast.error("Toggle failed");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/alert-rules/${rule.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-text-primary">{rule.name}</span>
          {!rule.enabled && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
              disabled
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-text-secondary">{summary}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {worldIds.length === 0 ? (
            <span className="text-[11px] text-text-tertiary">
              No push targets — alert row only.
            </span>
          ) : (
            worldIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent"
              >
                {worldName(id)}
              </span>
            ))
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {rule.enabled ? "Disable" : "Enable"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label="Delete rule"
        className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Trash2 size={14} />
        )}
      </button>
    </li>
  );
}

function summariseRule(rule: RuleRow): string {
  if (rule.kind === "threshold") {
    const c = rule.config as {
      subsystem?: string;
      field?: string;
      op?: ThresholdOp;
      value?: number;
    };
    return `${c.subsystem ?? "?"}.${c.field ?? "?"} ${OP_LABELS[c.op ?? "gt"]} ${c.value ?? "?"}`;
  }
  const c = rule.config as { eventType?: string };
  return `event: ${c.eventType ?? "?"}`;
}

// ─── Rule preview response ─────────────────────────────────────────

interface PreviewSample {
  deviceId: string;
  externalDeviceId: string;
  name: string;
  observed: number | null;
  matched: boolean;
}

type PreviewResult =
  | {
      kind: "threshold";
      previewSupported: true;
      sampled: number;
      matched: number;
      samples: PreviewSample[];
      note?: string;
    }
  | { kind: "event"; previewSupported: false; note: string };

// ─── Create form ────────────────────────────────────────────────────

function RuleForm({
  projectId,
  worlds,
  onCreated,
}: {
  projectId: string;
  worlds: WorldRow[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RuleKind>("threshold");
  const [subsystem, setSubsystem] = useState<string>("radar");
  const [field, setField] = useState<string>("occupancy");
  const [op, setOp] = useState<ThresholdOp>("gt");
  const [value, setValue] = useState<string>("0.7");
  const [eventType, setEventType] = useState<UpstreamEventType>("incident.posted");
  const [targetWorldIds, setTargetWorldIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const fieldsForSubsystem = FIELDS_BY_SUBSYSTEM[subsystem] ?? [];
  // Keep `field` valid when subsystem changes.
  const effectiveField = useMemo(() => {
    if (fieldsForSubsystem.includes(field)) return field;
    return fieldsForSubsystem[0] ?? "";
  }, [field, fieldsForSubsystem]);

  const runPreview = async () => {
    const numericValue = Number(value);
    if (kind === "threshold" && !Number.isFinite(numericValue)) {
      toast.error("Value must be a number");
      return;
    }
    setPreviewBusy(true);
    setPreview(null);
    try {
      const body =
        kind === "threshold"
          ? {
              kind: "threshold" as const,
              config: {
                subsystem,
                field: effectiveField,
                op,
                value: numericValue,
              },
            }
          : { kind: "event" as const, config: { eventType } };
      const res = await fetch(
        `/api/projects/${projectId}/alert-rules/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as PreviewResult | { error?: string };
      if (!res.ok) {
        toast.error((json as { error?: string }).error ?? "Preview failed");
        return;
      }
      setPreview(json as PreviewResult);
    } finally {
      setPreviewBusy(false);
    }
  };

  const create = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const numericValue = Number(value);
    if (kind === "threshold" && !Number.isFinite(numericValue)) {
      toast.error("Value must be a number");
      return;
    }
    setBusy(true);
    try {
      const body =
        kind === "threshold"
          ? {
              name: name.trim(),
              kind: "threshold" as const,
              config: {
                subsystem,
                field: effectiveField,
                op,
                value: numericValue,
              },
              targets: { worldIds: Array.from(targetWorldIds) },
            }
          : {
              name: name.trim(),
              kind: "event" as const,
              config: { eventType },
              targets: { worldIds: Array.from(targetWorldIds) },
            };
      const res = await fetch(`/api/projects/${projectId}/alert-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Create failed");
        return;
      }
      toast.success(`Rule "${name.trim()}" created`);
      setName("");
      setTargetWorldIds(new Set());
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line-soft bg-bg p-6">
      <h2 className="mb-4 text-lg font-medium text-text-primary">Create a rule</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-text-tertiary">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Occupancy above 70%"
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
          />
        </label>

        <div className="text-sm md:col-span-2">
          <span className="mb-1 block text-text-tertiary">Kind</span>
          <div className="inline-flex rounded-md border border-line-soft bg-bg text-xs">
            <button
              type="button"
              onClick={() => setKind("threshold")}
              className={`px-3 py-1.5 ${
                kind === "threshold"
                  ? "bg-surface-2 font-medium text-text-primary"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Threshold
            </button>
            <button
              type="button"
              onClick={() => setKind("event")}
              className={`px-3 py-1.5 ${
                kind === "event"
                  ? "bg-surface-2 font-medium text-text-primary"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Event
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-text-tertiary">
            {kind === "threshold"
              ? "Trigger when a device's status field crosses a numeric threshold."
              : "Trigger on a raw upstream event (incident, status change)."}
          </p>
        </div>

        {kind === "threshold" ? (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Subsystem</span>
              <select
                value={subsystem}
                onChange={(e) => setSubsystem(e.target.value)}
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              >
                {SUBSYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Field</span>
              <select
                value={effectiveField}
                onChange={(e) => setField(e.target.value)}
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              >
                {fieldsForSubsystem.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Operator</span>
              <select
                value={op}
                onChange={(e) => setOp(e.target.value as ThresholdOp)}
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              >
                {(Object.keys(OP_LABELS) as ThresholdOp[]).map((k) => (
                  <option key={k} value={k}>
                    {OP_LABELS[k]} ({k})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Value</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-text-primary"
              />
            </label>
          </>
        ) : (
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-text-tertiary">Event type</span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as UpstreamEventType)}
              className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
            >
              {EVENT_TYPES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        )}

        <fieldset className="text-sm md:col-span-2">
          <legend className="mb-1 text-text-tertiary">
            Push targets — worlds to notify
          </legend>
          <div className="flex flex-wrap gap-2">
            {worlds.length === 0 ? (
              <span className="text-[11px] text-text-tertiary">
                No worlds yet — the rule will still open alert rows.
              </span>
            ) : (
              worlds.map((w) => {
                const on = targetWorldIds.has(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      setTargetWorldIds((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(w.id);
                        else next.add(w.id);
                        return next;
                      })
                    }
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line-soft text-text-secondary hover:border-accent hover:text-accent"
                    }`}
                  >
                    {w.name}
                    {on && <X size={11} strokeWidth={2.2} />}
                  </button>
                );
              })
            )}
          </div>
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          Create rule
        </button>
        <button
          type="button"
          onClick={runPreview}
          disabled={previewBusy}
          title="Preview whether the rule would fire against the current fleet, without saving."
          className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {previewBusy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FlaskConical size={14} />
          )}
          Preview matches
        </button>
      </div>

      {preview && <PreviewPanel result={preview} onDismiss={() => setPreview(null)} />}
    </section>
  );
}

function PreviewPanel({
  result,
  onDismiss,
}: {
  result: PreviewResult;
  onDismiss: () => void;
}) {
  if (result.previewSupported === false) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-md border border-line-soft bg-surface-2 px-4 py-3 text-xs text-text-secondary">
        <FlaskConical size={13} className="mt-0.5 text-text-tertiary" />
        <p className="flex-1">{result.note}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss preview"
          className="text-text-tertiary hover:text-text-primary"
        >
          <X size={13} />
        </button>
      </div>
    );
  }
  const { sampled, matched, samples } = result;
  const anyMatched = matched > 0;
  return (
    <div className="mt-4 rounded-md border border-line-soft bg-surface-2 px-4 py-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-text-primary">
          <span
            className={`font-medium ${
              anyMatched ? "text-accent" : "text-text-secondary"
            }`}
          >
            {matched} of {sampled}
          </span>{" "}
          {matched === 1 ? "device would fire" : "devices would fire"} right now
          {sampled === 20 && (
            <span className="text-text-tertiary"> (sampled)</span>
          )}
          {result.note && (
            <span className="text-text-tertiary"> — {result.note}</span>
          )}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss preview"
          className="text-text-tertiary hover:text-text-primary"
        >
          <X size={13} />
        </button>
      </div>
      {samples.length > 0 && (
        <ul className="divide-y divide-line-soft rounded border border-line-soft bg-bg">
          {samples.slice(0, 8).map((s) => (
            <li
              key={s.deviceId}
              className="flex items-center gap-3 px-3 py-1.5"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  s.matched ? "bg-accent" : "bg-line-strong"
                }`}
              />
              <span className="flex-1 truncate text-text-primary">
                {s.name}
              </span>
              <span className="font-mono text-[10px] text-text-tertiary">
                {s.observed === null
                  ? "—"
                  : Number.isInteger(s.observed)
                    ? s.observed
                    : s.observed.toFixed(3)}
              </span>
            </li>
          ))}
          {samples.length > 8 && (
            <li className="px-3 py-1.5 text-center text-[10px] text-text-tertiary">
              +{samples.length - 8} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
