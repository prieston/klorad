"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
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

interface SourceRow {
  id: string;
  label: string;
  enabled: boolean;
  hasWebhook: boolean;
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
  const { data: sourcesData } = useSWR<{ sources: SourceRow[] }>(
    `/api/projects/${projectId}/sources`,
    fetcher,
  );
  const worlds = worldsData?.worlds ?? [];
  const sources = sourcesData?.sources ?? [];
  const rules = data?.rules ?? [];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
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
            Rules watch upstream webhook events and open an alert when a
            match fires. Add worlds under Push targets to notify their
            subscribers on the same event.
          </p>
        </div>
        <SeedDemoButton
          projectId={projectId}
          onSeeded={() => void mutate()}
        />
      </header>

      <DiagnosticsBanner
        orgId={orgId}
        projectId={projectId}
        sources={sources}
        rulesCount={rules.length}
        disabledRulesCount={rules.filter((r) => !r.enabled).length}
      />

      <section className="mt-6 rounded-2xl border border-line-soft bg-bg p-6">
        <h2 className="mb-4 text-lg font-medium text-text-primary">
          Create a rule
        </h2>
        <RuleDraftForm
          worlds={worlds}
          projectId={projectId}
          submitLabel="Create rule"
          submitIcon="plus"
          onSubmit={async (payload) => {
            const res = await fetch(`/api/projects/${projectId}/alert-rules`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = (await res.json().catch(() => null)) as
              | { error?: string }
              | null;
            if (!res.ok) {
              throw new Error(json?.error ?? "Create failed");
            }
            toast.success(`Rule "${payload.name}" created`);
            await mutate();
          }}
          resetOnSuccess
        />
      </section>

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
            No rules yet. Create one above, or click{" "}
            <span className="font-medium text-text-secondary">
              Seed demo rules
            </span>{" "}
            in the header for the canonical set that pairs with the
            mock&apos;s demo scenarios.
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

      <ActivityPanel projectId={projectId} />
    </main>
  );
}

// ─── Recent webhook activity ───────────────────────────────────────

interface RuleOutcomeRow {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  reason: string;
}

type WebhookOutcomeKind =
  | "unknown_source"
  | "not_registered"
  | "source_disabled"
  | "bad_signature"
  | "invalid_json"
  | "malformed_event"
  | "no_rules"
  | "no_matches"
  | "processed";

interface WebhookReceiptRow {
  id: string;
  at: number;
  sourceId: string;
  outcome: WebhookOutcomeKind;
  eventType: string | null;
  payloadPreview: string | null;
  rules: RuleOutcomeRow[];
  alertsCreated: number;
  pushesDelivered: number;
  note: string | null;
}

/**
 * Live feed of the last ~50 webhook receipts. Auto-refreshes every
 * 3 s. Each row shows the outcome (delivered vs bounced), matched vs
 * unmatched rules with a per-rule reason, and any dispatch note
 * (e.g. "no MobilityDevice row for externalId=…").
 *
 * The point: when an operator triggers a scenario on the mock and
 * doesn't see an alert, this panel tells them exactly where in the
 * pipeline it stopped — no need to read Vercel logs.
 */
function ActivityPanel({ projectId }: { projectId: string }) {
  const { data, mutate, isLoading } = useSWR<{
    receipts: WebhookReceiptRow[];
  }>(
    `/api/projects/${projectId}/alert-rules/recent-activity`,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: true },
  );
  const receipts = data?.receipts ?? [];

  return (
    <section className="mt-8 rounded-2xl border border-line-soft bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-medium text-text-primary">
            <Activity size={16} strokeWidth={1.7} className="text-accent" />
            Recent webhook activity
          </h2>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            Last {receipts.length} receipts, most recent first. Auto-refreshes
            every 3 s. In-memory, so it clears on a serverless cold start.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="text-xs text-text-tertiary hover:text-accent"
        >
          Refresh
        </button>
      </div>
      {isLoading && receipts.length === 0 ? (
        <p className="px-6 py-8 text-sm text-text-tertiary">Loading…</p>
      ) : receipts.length === 0 ? (
        <p className="px-6 py-8 text-sm text-text-tertiary">
          No webhook receipts yet. Trigger a scenario on the mock; if
          nothing shows up here after a few seconds, the webhook isn&apos;t
          reaching this deploy (check the source&apos;s webhook
          registration on the{" "}
          <span className="font-medium text-text-secondary">Sources</span>{" "}
          page).
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {receipts.map((r) => (
            <ReceiptRow key={r.id} receipt={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReceiptRow({ receipt }: { receipt: WebhookReceiptRow }) {
  const [expanded, setExpanded] = useState(false);
  const tone = outcomeTone(receipt.outcome);
  const matchedCount = receipt.rules.filter((r) => r.matched).length;

  return (
    <li className="px-6 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          aria-hidden
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone.dotClass}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={`text-xs font-medium ${tone.textClass}`}>
              {tone.label}
            </span>
            {receipt.eventType && (
              <span className="font-mono text-[11px] text-text-secondary">
                {receipt.eventType}
              </span>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
              {relativeFrom(receipt.at)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
            {receipt.outcome === "processed" && (
              <>
                <span>{matchedCount}/{receipt.rules.length} matched</span>
                <span>·</span>
                <span>
                  {receipt.alertsCreated} alert
                  {receipt.alertsCreated === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {receipt.pushesDelivered} push
                  {receipt.pushesDelivered === 1 ? "" : "es"}
                </span>
              </>
            )}
            {receipt.note && (
              <>
                {receipt.outcome === "processed" && <span>·</span>}
                <span className="text-amber-500">{receipt.note}</span>
              </>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 rounded-md border border-line-soft bg-surface-2 p-3">
          {receipt.rules.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                Per-rule outcome
              </p>
              <ul className="space-y-1">
                {receipt.rules.map((r) => (
                  <li
                    key={r.ruleId}
                    className="flex items-baseline gap-2 text-[11px]"
                  >
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        r.matched ? "bg-accent" : "bg-text-tertiary"
                      }`}
                    />
                    <span className="font-medium text-text-primary">
                      {r.ruleName}
                    </span>
                    <span className="text-text-secondary">· {r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {receipt.payloadPreview && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                Payload preview
              </p>
              <pre className="overflow-x-auto rounded bg-bg px-2 py-1.5 font-mono text-[10px] text-text-secondary">
                {receipt.payloadPreview}
              </pre>
            </div>
          )}
          <p className="text-[10px] text-text-tertiary">
            source <code>{receipt.sourceId}</code>
          </p>
        </div>
      )}
    </li>
  );
}

function outcomeTone(outcome: WebhookOutcomeKind): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  switch (outcome) {
    case "processed":
      return {
        label: "Processed",
        dotClass: "bg-emerald-500",
        textClass: "text-emerald-500",
      };
    case "no_matches":
      return {
        label: "No matches",
        dotClass: "bg-amber-500",
        textClass: "text-amber-500",
      };
    case "no_rules":
      return {
        label: "No rules",
        dotClass: "bg-amber-500",
        textClass: "text-amber-500",
      };
    case "source_disabled":
      return {
        label: "Source disabled",
        dotClass: "bg-amber-500",
        textClass: "text-amber-500",
      };
    case "not_registered":
      return {
        label: "Not registered",
        dotClass: "bg-red-500",
        textClass: "text-red-500",
      };
    case "unknown_source":
      return {
        label: "Unknown source",
        dotClass: "bg-red-500",
        textClass: "text-red-500",
      };
    case "bad_signature":
      return {
        label: "Bad signature",
        dotClass: "bg-red-500",
        textClass: "text-red-500",
      };
    case "invalid_json":
    case "malformed_event":
      return {
        label: "Malformed",
        dotClass: "bg-red-500",
        textClass: "text-red-500",
      };
    default:
      return {
        label: outcome,
        dotClass: "bg-text-tertiary",
        textClass: "text-text-secondary",
      };
  }
}

function relativeFrom(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ts).toLocaleString();
}

// ─── Seed demo rules button ────────────────────────────────────────

/**
 * Fires the backend seeder that creates the canonical rules paired
 * with the mock's demo scenarios. Idempotent by rule name — a repeat
 * click is safe; it just skips rules that already exist and reports
 * a "0 created, N skipped" toast.
 */
function SeedDemoButton({
  projectId,
  onSeeded,
}: {
  projectId: string;
  onSeeded: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const seed = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/alert-rules/seed-demo`,
        { method: "POST" },
      );
      const json = (await res.json().catch(() => null)) as
        | {
            created?: number;
            skipped?: number;
            totalTemplates?: number;
            error?: string;
          }
        | null;
      if (!res.ok) {
        toast.error(json?.error ?? "Seed failed");
        return;
      }
      const created = json?.created ?? 0;
      const skipped = json?.skipped ?? 0;
      if (created === 0 && skipped > 0) {
        toast.info(
          `All ${skipped} demo rule${skipped === 1 ? "" : "s"} already exist.`,
        );
      } else if (created > 0) {
        toast.success(
          `Seeded ${created} demo rule${created === 1 ? "" : "s"}` +
            (skipped > 0 ? ` (${skipped} already existed)` : ""),
        );
      } else {
        toast.info("No rules seeded.");
      }
      onSeeded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={seed}
      disabled={busy}
      title="Create demo rules matched to the mock scenarios (radar jam, traffic slowdown, DMS fault, incident posted). Safe to click twice."
      className="inline-flex shrink-0 items-center gap-2 rounded-md border border-accent bg-accent-soft px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-accent-contrast disabled:opacity-50"
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Sparkles size={12} />
      )}
      Seed demo rules
    </button>
  );
}

// ─── Diagnostics banner ────────────────────────────────────────────

/**
 * Compact "why aren't my alerts firing?" surface. Rules land in the
 * table but nothing arrives from the pipeline for a handful of
 * silent-drop reasons — this banner flags the top three:
 *
 *   • No source has a webhook registered → upstream events never
 *     reach the mobility webhook endpoint. Most common cause on a
 *     fresh setup.
 *   • Some sources are disabled → their events are 200-ignored
 *     (silently) even if the webhook is wired.
 *   • Every rule is disabled → events land but every rule short-
 *     circuits on `enabled: false`.
 *
 * Green health state renders too so operators can confirm at a
 * glance that the plumbing is intact.
 */
function DiagnosticsBanner({
  orgId,
  projectId,
  sources,
  rulesCount,
  disabledRulesCount,
}: {
  orgId: string;
  projectId: string;
  sources: SourceRow[];
  rulesCount: number;
  disabledRulesCount: number;
}) {
  const totalSources = sources.length;
  const webhookSources = sources.filter((s) => s.hasWebhook).length;
  const enabledSources = sources.filter((s) => s.enabled).length;
  const disabledSources = totalSources - enabledSources;

  const issues: Array<{ tone: "warn" | "info"; text: React.ReactNode }> = [];

  if (totalSources === 0) {
    issues.push({
      tone: "warn",
      text: (
        <>
          No data sources yet. Alerts fire on events pushed from a
          source webhook. Add one first at{" "}
          <Link
            href={`/org/${orgId}/projects/${projectId}/sources`}
            className="underline underline-offset-2 hover:text-text-primary"
          >
            Sources
          </Link>
          .
        </>
      ),
    });
  } else if (webhookSources === 0) {
    issues.push({
      tone: "warn",
      text: (
        <>
          {totalSources} source{totalSources === 1 ? "" : "s"} configured,
          but <strong>none has a webhook registered</strong>. Upstream
          events never reach this project. Register one at{" "}
          <Link
            href={`/org/${orgId}/projects/${projectId}/sources`}
            className="underline underline-offset-2 hover:text-text-primary"
          >
            Sources
          </Link>
          .
        </>
      ),
    });
  } else if (webhookSources < totalSources) {
    issues.push({
      tone: "info",
      text: (
        <>
          {webhookSources} of {totalSources} sources have a webhook
          registered. Events from the other{" "}
          {totalSources - webhookSources} won&apos;t reach the alert
          engine.
        </>
      ),
    });
  }

  if (disabledSources > 0 && totalSources > 0) {
    issues.push({
      tone: "info",
      text: (
        <>
          {disabledSources} source{disabledSources === 1 ? " is" : "s are"}{" "}
          disabled. Their events are silently ignored even if the
          webhook fires.
        </>
      ),
    });
  }

  if (rulesCount === 0) {
    issues.push({
      tone: "info",
      text: (
        <>
          No rules configured. Alerts fire only when a rule matches an
          incoming event. Click{" "}
          <span className="font-medium text-text-primary">
            Seed demo rules
          </span>{" "}
          in the header for the canonical set paired with the mock&apos;s
          scenarios (radar jam, traffic slowdown, DMS fault, incident
          posted).
        </>
      ),
    });
  } else if (disabledRulesCount === rulesCount) {
    issues.push({
      tone: "warn",
      text: (
        <>
          All {rulesCount} rule{rulesCount === 1 ? " is" : "s are"}{" "}
          disabled. Enable at least one for alerts to fire.
        </>
      ),
    });
  }

  if (issues.length === 0) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs">
        <CheckCircle2
          size={14}
          className="mt-0.5 shrink-0 text-emerald-500"
        />
        <p className="text-text-secondary">
          Alert plumbing looks healthy. {webhookSources} of {totalSources}{" "}
          sources have a webhook registered, {rulesCount - disabledRulesCount}{" "}
          of {rulesCount} rules are enabled. Trigger a scenario on the mock
          to see one fire.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {issues.map((iss, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs ${
            iss.tone === "warn"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-line-soft bg-surface-2"
          }`}
        >
          <AlertTriangle
            size={14}
            className={`mt-0.5 shrink-0 ${
              iss.tone === "warn" ? "text-amber-500" : "text-text-tertiary"
            }`}
          />
          <p
            className={
              iss.tone === "warn" ? "text-text-primary" : "text-text-secondary"
            }
          >
            {iss.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Row (compact display, expands to edit form on Edit click) ─────

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
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const worldName = (id: string) =>
    worlds.find((w) => w.id === id)?.name ?? `world:${id.slice(0, 6)}`;
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

  const runPreview = async () => {
    setPreviewBusy(true);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/alert-rules/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: rule.kind, config: rule.config }),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | PreviewResult
        | { error?: string }
        | null;
      if (!res.ok || !json) {
        toast.error(
          (json as { error?: string } | null)?.error ?? "Preview failed",
        );
        return;
      }
      setPreview(json as PreviewResult);
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <li className="px-6 py-4">
      {editing ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
              Editing · {rule.name}
            </p>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
          <RuleDraftForm
            worlds={worlds}
            projectId={projectId}
            initial={{
              name: rule.name,
              kind: rule.kind,
              config: rule.config,
              targets: rule.targets,
            }}
            submitLabel="Save changes"
            submitIcon="pencil"
            onSubmit={async (payload) => {
              const res = await fetch(
                `/api/projects/${projectId}/alert-rules/${rule.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                },
              );
              const json = (await res.json().catch(() => null)) as
                | { error?: string }
                | null;
              if (!res.ok) {
                throw new Error(json?.error ?? "Update failed");
              }
              toast.success(`Rule "${payload.name}" saved`);
              setEditing(false);
              onChanged();
            }}
          />
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-text-primary">
                {rule.name}
              </span>
              {!rule.enabled && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                  disabled
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-text-secondary">
              {summariseRule(rule)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {worldIds.length === 0 ? (
                <span className="text-[11px] text-text-tertiary">
                  No push targets. Opens an alert row only.
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
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewBusy || busy}
              title="Fire this rule against the current fleet without saving. Shows which devices would match right now."
              className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {previewBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FlaskConical size={12} />
              )}
              Preview
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              aria-label="Edit rule"
              className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Pencil size={12} />
              Edit
            </button>
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
          </div>
        </div>
      )}

      {preview && !editing && (
        <PreviewPanel result={preview} onDismiss={() => setPreview(null)} />
      )}
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

// ─── Draft form — dual-purpose create / edit ───────────────────────

interface DraftInitial {
  name: string;
  kind: RuleKind;
  config: unknown;
  targets: { worldIds?: string[] } | null;
}

interface RulePayload {
  name: string;
  kind: RuleKind;
  config: unknown;
  targets: { worldIds: string[] };
}

/**
 * Self-managing rule form. Used by both the top-of-page "Create"
 * section and the inline "Edit" mode inside each row. Owns its own
 * form state; the parent supplies the initial values (create → all
 * empty defaults; edit → hydrate from the existing rule) and a
 * `onSubmit` callback that decides whether to POST or PATCH.
 *
 * Includes a "Preview matches" button — same `/test` endpoint used
 * by the per-row Preview action, but scoped to the form's current
 * (possibly unsaved) draft. Lets you tune values against the fleet
 * before saving.
 */
function RuleDraftForm({
  worlds,
  projectId,
  initial,
  submitLabel,
  submitIcon,
  onSubmit,
  resetOnSuccess = false,
}: {
  worlds: WorldRow[];
  projectId: string;
  initial?: DraftInitial;
  submitLabel: string;
  submitIcon: "plus" | "pencil";
  onSubmit: (payload: RulePayload) => Promise<void>;
  /** Create form clears back to defaults after success; edit form
   *  keeps the values so the operator sees what they saved. */
  resetOnSuccess?: boolean;
}) {
  const initialThreshold = readThresholdConfig(initial);
  const initialEvent = readEventConfig(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<RuleKind>(initial?.kind ?? "threshold");
  const [subsystem, setSubsystem] = useState<string>(
    initialThreshold.subsystem ?? "radar",
  );
  const [field, setField] = useState<string>(
    initialThreshold.field ?? "occupancy",
  );
  const [op, setOp] = useState<ThresholdOp>(initialThreshold.op ?? "gt");
  const [value, setValue] = useState<string>(
    initialThreshold.value != null ? String(initialThreshold.value) : "0.7",
  );
  const [eventType, setEventType] = useState<UpstreamEventType>(
    initialEvent.eventType ?? "incident.posted",
  );
  const [targetWorldIds, setTargetWorldIds] = useState<Set<string>>(
    () => new Set(initial?.targets?.worldIds ?? []),
  );
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const fieldsForSubsystem = FIELDS_BY_SUBSYSTEM[subsystem] ?? [];
  // Keep `field` valid when subsystem changes.
  const effectiveField = useMemo(() => {
    if (fieldsForSubsystem.includes(field)) return field;
    return fieldsForSubsystem[0] ?? "";
  }, [field, fieldsForSubsystem]);

  const buildPayload = (): RulePayload | null => {
    if (!name.trim()) {
      toast.error("Name is required");
      return null;
    }
    if (kind === "threshold") {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        toast.error("Value must be a number");
        return null;
      }
      return {
        name: name.trim(),
        kind: "threshold",
        config: {
          subsystem,
          field: effectiveField,
          op,
          value: numericValue,
        },
        targets: { worldIds: Array.from(targetWorldIds) },
      };
    }
    return {
      name: name.trim(),
      kind: "event",
      config: { eventType },
      targets: { worldIds: Array.from(targetWorldIds) },
    };
  };

  const runPreview = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setPreviewBusy(true);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/alert-rules/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: payload.kind, config: payload.config }),
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

  const submit = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setBusy(true);
    try {
      await onSubmit(payload);
      if (resetOnSuccess) {
        setName("");
        setTargetWorldIds(new Set());
        setPreview(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const SubmitIcon = submitIcon === "plus" ? Plus : Pencil;

  return (
    <div>
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
              onChange={(e) =>
                setEventType(e.target.value as UpstreamEventType)
              }
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
            Push targets · worlds to notify
          </legend>
          <div className="flex flex-wrap gap-2">
            {worlds.length === 0 ? (
              <span className="text-[11px] text-text-tertiary">
                No worlds yet. The rule will still open alert rows.
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
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <SubmitIcon size={14} />
          )}
          {submitLabel}
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

      {preview && (
        <PreviewPanel result={preview} onDismiss={() => setPreview(null)} />
      )}
    </div>
  );
}

function readThresholdConfig(initial: DraftInitial | undefined): {
  subsystem?: string;
  field?: string;
  op?: ThresholdOp;
  value?: number;
} {
  if (!initial || initial.kind !== "threshold") return {};
  const c = initial.config as {
    subsystem?: string;
    field?: string;
    op?: ThresholdOp;
    value?: number;
  } | null;
  return c ?? {};
}

function readEventConfig(initial: DraftInitial | undefined): {
  eventType?: UpstreamEventType;
} {
  if (!initial || initial.kind !== "event") return {};
  const c = initial.config as { eventType?: UpstreamEventType } | null;
  return c ?? {};
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
            <span className="text-text-tertiary"> · {result.note}</span>
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
