"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Interactive demo control panel — the "sell it in a click" surface.
 *
 * Layout:
 *   - Grid of scenario cards. Each card: what it does, downstream
 *     effect (which webhook events fire, what alert rule shape
 *     matches), an "Active" badge if the scenario is currently
 *     running, a Trigger button.
 *   - Global "Reset all" button — clears every 3-min override, stops
 *     the ticker, cancels the running incident, and republishes
 *     `device.status_changed` for each affected device so downstream
 *     sees the "restored" state immediately.
 *   - Live event feed (SSE on `/api/stream`) with the last ~40
 *     events so you can watch webhooks fly by as you click.
 *
 * All calls hit same-origin API routes; the browser sends
 * `Sec-Fetch-Site: same-origin` which the mock's auth layer accepts
 * without Basic credentials (see `lib/auth.ts:isSameOriginRequest`).
 */

interface ScenarioStatus {
  incident: { running: boolean; id: string | null };
  traffic: { running: boolean };
  overrides: Array<{
    externalId: string;
    reason: string;
    expiresAt: number;
    remainingMs: number;
  }>;
}

interface FeedEvent {
  type: string;
  at: string;
  payload: unknown;
  seenAt: number;
}

type ScenarioName =
  | "incident"
  | "traffic"
  | "radar-spike"
  | "dms-alarm"
  | "incident-cascade"
  | "vms-inspection";

interface ScenarioDef {
  key: ScenarioName;
  title: string;
  emoji: string;
  blurb: string;
  emits: string;
  matches: string;
  /** Compute the "Active" badge from live status. */
  isActive?(status: ScenarioStatus): boolean;
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: "radar-spike",
    title: "Radar occupancy spike",
    emoji: "🚦",
    blurb:
      "One radar's occupancy jumps to 0.85 and mean speed drops to 18 km/h for 3 minutes. The classic 'jam forming' shape.",
    emits: "device.status_changed × 2  (start + expiry)",
    matches: "threshold rule where field=occupancy, op≥, value=0.7",
    isActive: (s) =>
      s.overrides.some((o) => o.reason.toLowerCase().includes("radar")),
  },
  {
    key: "dms-alarm",
    title: "DMS sign fault",
    emoji: "🛑",
    blurb:
      "One DMS flips to shortStatus=0x0004, connectable=false, message='SIGN FAULT'. Reads as offline + alarmed downstream.",
    emits: "device.status_changed × 2  (start + expiry)",
    matches: "event rule for type=device.status_changed + kind=alarmed",
    isActive: (s) =>
      s.overrides.some((o) => o.reason.toLowerCase().includes("dms")),
  },
  {
    key: "incident",
    title: "Incident response",
    emoji: "🚨",
    blurb:
      "Creates an AID-triggered incident and walks its status every 6 seconds: posted → acknowledged → en_route → on_scene → resolved.",
    emits: "incident.posted + incident.status_changed (×4)",
    matches: "event rule for type=incident.posted",
    isActive: (s) => s.incident.running,
  },
  {
    key: "traffic",
    title: "Traffic flow ticker",
    emoji: "📈",
    blurb:
      "Starts the 1 Hz VDS traffic loop across every radar. Stages a scripted slowdown on one radar 15 s in. Feeds live-graph demos.",
    emits: "vds.tick (once per second, per radar)",
    matches: "threshold rule where field=speed, op≤, value=30",
    isActive: (s) => s.traffic.running,
  },
  {
    key: "incident-cascade",
    title: "Incident cascade",
    emoji: "🔗",
    blurb:
      "Combines Incident + Radar spike + DMS fault with a 4 s stagger. Reproduces the 'something big just happened' cascade.",
    emits: "incident.posted → device.status_changed × 2",
    matches: "any of the above rules will fire",
    isActive: (s) =>
      s.incident.running &&
      s.overrides.some((o) => o.reason.toLowerCase().includes("radar")),
  },
  {
    key: "vms-inspection",
    title: "VMS inspection world",
    emoji: "🏗️",
    blurb:
      "Provisions a demo world scoped to VMS signs and returns the install URL. Not time-based, so there's nothing to reset.",
    emits: "no events (world provisioning only)",
    matches: "n/a",
  },
];

export function DemoControlPanel() {
  const [status, setStatus] = useState<ScenarioStatus | null>(null);
  const [busy, setBusy] = useState<ScenarioName | "reset" | null>(null);
  const [lastResult, setLastResult] = useState<{
    name: string;
    body: unknown;
    ok: boolean;
    at: number;
  } | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [feedConnected, setFeedConnected] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ScenarioStatus;
      setStatus(data);
    } catch {
      /* transient; poll again shortly */
    }
  }, []);

  // Poll status every 3 s so countdowns + active badges stay fresh.
  useEffect(() => {
    void refreshStatus();
    const iv = setInterval(refreshStatus, 3000);
    return () => clearInterval(iv);
  }, [refreshStatus]);

  // Live event feed. Keeps the most recent ~40; older entries drop off.
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setFeedConnected(true);
    es.onerror = () => setFeedConnected(false);
    const onEvent = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as {
          type: string;
          at: string;
          payload: unknown;
        };
        setFeed((prev) => {
          const next = [{ ...parsed, seenAt: Date.now() }, ...prev];
          return next.slice(0, 40);
        });
      } catch {
        /* skip malformed frames */
      }
    };
    for (const type of [
      "device.status_changed",
      "incident.posted",
      "incident.status_changed",
      "vds.tick",
    ]) {
      es.addEventListener(type, onEvent);
    }
    return () => es.close();
  }, []);

  const trigger = async (name: ScenarioName) => {
    setBusy(name);
    try {
      const res = await fetch(`/api/demo/scenario/${name}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      setLastResult({ name, body, ok: res.ok, at: Date.now() });
      await refreshStatus();
    } catch (err) {
      setLastResult({
        name,
        body: { error: String(err) },
        ok: false,
        at: Date.now(),
      });
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      const res = await fetch(`/api/demo/scenario/reset`, { method: "POST" });
      const body = await res.json().catch(() => null);
      setLastResult({ name: "reset", body, ok: res.ok, at: Date.now() });
      await refreshStatus();
    } catch (err) {
      setLastResult({
        name: "reset",
        body: { error: String(err) },
        ok: false,
        at: Date.now(),
      });
    } finally {
      setBusy(null);
    }
  };

  const anythingActive = useMemo(() => {
    if (!status) return false;
    return (
      status.incident.running ||
      status.traffic.running ||
      status.overrides.length > 0
    );
  }, [status]);

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Scenario runner</h2>
        <button
          type="button"
          onClick={reset}
          disabled={busy !== null || !anythingActive}
          title={
            anythingActive
              ? "Clear every 3-minute override, stop the traffic ticker, cancel the running incident, and re-emit device.status_changed for each affected device."
              : "Nothing to reset. No scenarios are active."
          }
          style={{
            appearance: "none",
            border: "1px solid #ef4444",
            background: anythingActive ? "#ef4444" : "transparent",
            color: anythingActive ? "white" : "#ef4444",
            padding: "6px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: busy !== null || !anythingActive ? "not-allowed" : "pointer",
            opacity: busy === "reset" ? 0.6 : 1,
            transition: "background-color 150ms ease",
          }}
        >
          {busy === "reset" ? "Resetting…" : "Reset all to normal"}
        </button>
      </div>

      {status ? <ActiveSummary status={status} /> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        {SCENARIOS.map((s) => {
          const active = status ? Boolean(s.isActive?.(status)) : false;
          return (
            <ScenarioCard
              key={s.key}
              def={s}
              active={active}
              busy={busy === s.key}
              onTrigger={() => void trigger(s.key)}
            />
          );
        })}
      </div>

      {lastResult ? (
        <ResultChip result={lastResult} onDismiss={() => setLastResult(null)} />
      ) : null}

      <LiveFeed events={feed} connected={feedConnected} />
    </section>
  );
}

function ActiveSummary({ status }: { status: ScenarioStatus }) {
  const chips: Array<{ label: string; tone: "hot" | "warn" }> = [];
  if (status.incident.running) {
    chips.push({
      label: `Incident ${status.incident.id ? `#${status.incident.id.slice(0, 6)}` : ""} running`,
      tone: "hot",
    });
  }
  if (status.traffic.running) {
    chips.push({ label: "Traffic ticker running", tone: "warn" });
  }
  for (const o of status.overrides) {
    chips.push({
      label: `${o.externalId} · ${formatRemaining(o.remainingMs)}`,
      tone: "warn",
    });
  }
  if (chips.length === 0) {
    return (
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 4px 0" }}>
        All quiet. No scenarios active.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            background: c.tone === "hot" ? "#7f1d1d" : "#78350f",
            color: c.tone === "hot" ? "#fecaca" : "#fde68a",
            border:
              c.tone === "hot"
                ? "1px solid #b91c1c"
                : "1px solid #b45309",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: c.tone === "hot" ? "#fecaca" : "#fde68a",
            }}
          />
          {c.label}
        </span>
      ))}
    </div>
  );
}

function ScenarioCard({
  def,
  active,
  busy,
  onTrigger,
}: {
  def: ScenarioDef;
  active: boolean;
  busy: boolean;
  onTrigger: () => void;
}) {
  return (
    <article
      style={{
        border: active ? "1px solid #f59e0b" : "1px solid #1e293b",
        background: active ? "rgba(245, 158, 11, 0.08)" : "#0f172a",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }} aria-hidden>
            {def.emoji}
          </span>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            {def.title}
          </h3>
        </div>
        {active ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#fde68a",
              background: "rgba(245, 158, 11, 0.16)",
              border: "1px solid #b45309",
              padding: "2px 6px",
              borderRadius: 999,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Active
          </span>
        ) : null}
      </header>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#cbd5e1",
        }}
      >
        {def.blurb}
      </p>
      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "min-content 1fr",
          columnGap: 8,
          rowGap: 4,
          fontSize: 11,
        }}
      >
        <dt style={{ color: "#94a3b8" }}>Emits</dt>
        <dd style={{ margin: 0, color: "#e2e8f0", fontFamily: "monospace" }}>
          {def.emits}
        </dd>
        <dt style={{ color: "#94a3b8" }}>Matches</dt>
        <dd style={{ margin: 0, color: "#e2e8f0", fontFamily: "monospace" }}>
          {def.matches}
        </dd>
      </dl>
      <button
        type="button"
        onClick={onTrigger}
        disabled={busy}
        style={{
          appearance: "none",
          alignSelf: "flex-start",
          border: "1px solid #38bdf8",
          background: busy ? "transparent" : "#0369a1",
          color: busy ? "#38bdf8" : "white",
          padding: "6px 12px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          marginTop: "auto",
        }}
      >
        {busy ? "Triggering…" : active ? "Trigger again" : "Trigger"}
      </button>
    </article>
  );
}

function ResultChip({
  result,
  onDismiss,
}: {
  result: { name: string; body: unknown; ok: boolean; at: number };
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        marginTop: 12,
        padding: 10,
        border: "1px solid",
        borderColor: result.ok ? "#166534" : "#7f1d1d",
        background: result.ok ? "rgba(22, 101, 52, 0.15)" : "rgba(127, 29, 29, 0.15)",
        borderRadius: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#e2e8f0" }}>
          <strong>{result.ok ? "Fired" : "Failed"}:</strong> {result.name}
        </p>
        <pre
          style={{
            marginTop: 6,
            marginBottom: 0,
            fontSize: 11,
            fontFamily: "monospace",
            color: "#cbd5e1",
            background: "#020617",
            padding: 8,
            borderRadius: 6,
            overflowX: "auto",
            maxHeight: 160,
          }}
        >
          {JSON.stringify(result.body, null, 2)}
        </pre>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          color: "#94a3b8",
          fontSize: 16,
          cursor: "pointer",
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}

function LiveFeed({
  events,
  connected,
}: {
  events: FeedEvent[];
  connected: boolean;
}) {
  const scrollRef = useRef<HTMLUListElement | null>(null);
  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Live event feed
        </h3>
        <span
          style={{
            fontSize: 11,
            color: connected ? "#4ade80" : "#94a3b8",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: connected ? "#4ade80" : "#94a3b8",
            }}
          />
          {connected ? "SSE live" : "Reconnecting…"}
        </span>
      </div>
      <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 8px 0" }}>
        Every event that fires — webhooks fan out from here to any
        registered consumer + the Klorad Mobility webhook endpoint if
        wired.
      </p>
      {events.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>
          Nothing yet. Trigger a scenario above to see events land.
        </p>
      ) : (
        <ul
          ref={scrollRef}
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            border: "1px solid #1e293b",
            borderRadius: 8,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {events.map((e, i) => (
            <li
              key={`${e.seenAt}-${i}`}
              style={{
                borderBottom:
                  i === events.length - 1 ? "none" : "1px solid #1e293b",
                padding: "6px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ color: "#94a3b8", minWidth: 62 }}>
                {formatClock(e.at)}
              </span>
              <span
                style={{
                  minWidth: 160,
                  color:
                    e.type === "vds.tick"
                      ? "#38bdf8"
                      : e.type.startsWith("incident.")
                        ? "#f59e0b"
                        : "#4ade80",
                }}
              >
                {e.type}
              </span>
              <span
                style={{
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {summarize(e.type, e.payload)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(11, 19);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s left`;
  return `${Math.floor(s / 60)}m ${s % 60}s left`;
}

/** One-liner summary per event type so the feed row stays scannable. */
function summarize(type: string, payload: unknown): string {
  const p = payload as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return "";
  if (type === "vds.tick") {
    const speed = p.speed;
    const volume = p.volume;
    const occupancy = p.occupancy;
    const deviceId = p.deviceId;
    return `${deviceId} · v=${volume} s=${speed} o=${occupancy}`;
  }
  if (type === "device.status_changed") {
    const externalId = p.externalId ?? p.deviceId;
    const subsystem = p.subsystem;
    return `${subsystem ?? "?"} · ${externalId ?? "?"}`;
  }
  if (type.startsWith("incident.")) {
    const id = p.id;
    const status = p.status;
    const title = p.title;
    return `#${typeof id === "string" ? id.slice(0, 6) : "?"} · ${status ?? ""} · ${title ?? ""}`;
  }
  return JSON.stringify(payload).slice(0, 120);
}
