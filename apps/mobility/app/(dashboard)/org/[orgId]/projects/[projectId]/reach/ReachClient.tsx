"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Eye,
  Megaphone,
  Send,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrganizationRole } from "@prisma/client";

interface Broadcast {
  id: string;
  title: string;
  body: string;
  targetPath: string | null;
  attempted: number;
  delivered: number;
  pruned: number;
  opened: number;
  createdAt: string;
  sender: string | null;
}

interface ReachResponse {
  broadcasts: Broadcast[];
  subscriberCount: number;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

export function ReachClient({
  projectId,
  projectTitle,
  yourOrgRole,
}: {
  projectId: string;
  projectTitle: string;
  yourOrgRole: OrganizationRole;
}) {
  const { data, isLoading, mutate } = useSWR<ReachResponse>(
    `/api/projects/${projectId}/broadcasts`,
    fetcher,
  );
  const broadcasts = data?.broadcasts ?? [];
  const subscriberCount = data?.subscriberCount ?? 0;
  const canSend =
    yourOrgRole === "owner" ||
    yourOrgRole === "admin" ||
    yourOrgRole === "member";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetPath: targetPath.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        id?: string;
        attempted?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Send failed");
        return;
      }
      toast.success(
        json.attempted && json.attempted > 0
          ? `Queued for ${json.attempted} subscriber${json.attempted === 1 ? "" : "s"}`
          : "Broadcast saved (no subscribers yet)",
      );
      setTitle("");
      setBody("");
      setTargetPath("");
      void mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const totals = broadcasts.reduce(
    (acc, b) => {
      acc.sent += 1;
      acc.delivered += b.delivered;
      acc.opened += b.opened;
      return acc;
    },
    { sent: 0, delivered: 0, opened: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-10">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {projectTitle}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Reach.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          Send operational notices to commuters subscribed to your traveller
          map. Useful for planned road work, dynamic-message previews, or
          system status when an ATMS subsystem is down.
        </p>
      </header>

      {/* Subscriber + delivery preamble */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} label="Subscribers" value={subscriberCount} />
        <Stat icon={Send} label="Sent (50 most recent)" value={totals.sent} />
        <Stat
          icon={Bell}
          label="Delivered"
          value={totals.delivered}
          tone={totals.delivered > 0 ? "primary" : "muted"}
        />
        <Stat
          icon={Eye}
          label="Opened"
          value={totals.opened}
          tone={totals.opened > 0 ? "primary" : "muted"}
        />
      </section>

      {/* Delivery warning when no subscribers / no public surface yet */}
      {subscriberCount === 0 && (
        <section className="mb-6 flex items-start gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-sm">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-600"
          >
            <AlertTriangle size={14} strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="font-medium text-text-primary">
              No subscribers yet.
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              The Mobility public PWA + push-subscribe prompt ships in a
              follow-up arc. Broadcasts composed here persist on the project
              and will be delivered to subscribers once the public surface
              starts gathering them.
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        {/* Compose */}
        <section className="rounded-2xl border border-line-soft bg-bg p-6">
          <div className="mb-4 flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"
            >
              <Megaphone size={14} strokeWidth={1.8} />
            </span>
            <h2 className="text-lg font-medium text-text-primary">Compose</h2>
          </div>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
                Title
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. PATHE southbound — single-lane closure"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
              <p className="mt-1 text-[10px] text-text-tertiary">
                {80 - title.length} characters left
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
                Body
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="Two-line briefing the operator can act on. Iconography reads better short."
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
              <p className="mt-1 text-[10px] text-text-tertiary">
                {280 - body.length} characters left
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
                Deep link (optional)
              </span>
              <input
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/m/<projectId>?focus=24432"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-xs text-text-primary"
              />
              <p className="mt-1 text-[10px] text-text-tertiary">
                Where the notification taps to. Leave blank for the traveller
                map root.
              </p>
            </label>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={send}
                disabled={!canSend || submitting || !title.trim() || !body.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Send size={14} strokeWidth={1.8} />
                {submitting ? "Sending…" : "Send broadcast"}
              </button>
            </div>
          </div>
        </section>

        {/* Live preview */}
        <section className="rounded-2xl border border-line-soft bg-surface-2 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Bell
              size={14}
              strokeWidth={1.8}
              className="text-text-tertiary"
              aria-hidden
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              Preview
            </span>
          </div>
          <div className="rounded-xl border border-line-soft bg-bg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
              >
                <Megaphone size={14} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                  {projectTitle} · now
                </p>
                <h3 className="mt-0.5 text-sm font-medium text-text-primary">
                  {title || "Title goes here"}
                </h3>
                <p className="mt-0.5 text-xs leading-snug text-text-secondary">
                  {body || "Body text appears in the OS notification balloon."}
                </p>
              </div>
            </div>
            {targetPath && (
              <p className="mt-3 truncate font-mono text-[10px] text-text-tertiary">
                ↗ {targetPath}
              </p>
            )}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-text-tertiary">
            Renders approximately. Each platform layouts notifications
            differently — iOS truncates title at ~48 chars, Android folds
            body into a card.
          </p>
        </section>
      </div>

      {/* History */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-line-soft bg-bg">
        <div className="flex items-center justify-between border-b border-line-soft bg-surface-2 px-5 py-3">
          <h2 className="text-sm font-medium text-text-primary">History</h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            Last 50
          </span>
        </div>
        {isLoading && broadcasts.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-text-tertiary">
            Loading…
          </p>
        ) : broadcasts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CheckCircle2
              size={28}
              strokeWidth={1.6}
              className="mx-auto text-text-tertiary"
              aria-hidden
            />
            <p className="mt-3 text-sm text-text-tertiary">
              No broadcasts sent yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {broadcasts.map((b) => (
              <BroadcastRow key={b.id} broadcast={b} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/* ─── Row ──────────────────────────────────────────────────────────── */

function BroadcastRow({ broadcast }: { broadcast: Broadcast }) {
  const openRate =
    broadcast.delivered > 0
      ? Math.round((broadcast.opened / broadcast.delivered) * 100)
      : null;
  return (
    <li className="grid items-start gap-3 px-5 py-4 md:grid-cols-[auto_1fr_auto]">
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent"
      >
        <Megaphone size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-text-primary">
          {broadcast.title}
        </h3>
        <p className="mt-0.5 text-xs leading-snug text-text-secondary">
          {broadcast.body}
        </p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
          {broadcast.sender && <>{broadcast.sender} · </>}
          {new Date(broadcast.createdAt).toLocaleString()}
          {broadcast.targetPath && (
            <span className="ml-1.5 font-mono text-[10px] normal-case text-text-tertiary">
              ↗ {broadcast.targetPath}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
        <Counter label="Sent" value={broadcast.attempted} />
        <Counter
          label="Delivered"
          value={broadcast.delivered}
          tone={broadcast.delivered > 0 ? "primary" : "muted"}
        />
        <Counter
          label="Opened"
          value={broadcast.opened}
          sub={openRate != null ? `${openRate}%` : undefined}
          tone={broadcast.opened > 0 ? "success" : "muted"}
        />
      </div>
    </li>
  );
}

/* ─── Primitives ───────────────────────────────────────────────────── */

function Stat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "primary" | "muted";
}) {
  const cls =
    tone === "muted"
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

function Counter({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "primary" | "success" | "muted";
}) {
  const cls =
    tone === "success"
      ? "text-emerald-600"
      : tone === "primary"
        ? "text-accent"
        : "text-text-tertiary";
  return (
    <div className="rounded-md border border-line-soft bg-surface-2 px-2.5 py-1.5 text-center">
      <div className="text-[9px] font-medium text-text-tertiary">{label}</div>
      <div className={`font-mono text-xs ${cls}`}>{value.toLocaleString()}</div>
      {sub && <div className="text-[9px] text-text-tertiary">{sub}</div>}
    </div>
  );
}
