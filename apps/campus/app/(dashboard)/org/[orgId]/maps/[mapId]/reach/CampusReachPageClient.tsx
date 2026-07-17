"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import {
  Bell,
  History,
  Send,
  Users,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
  QrShare,
  Select,
  Textarea,
} from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

interface Props {
  orgId: string;
  mapId: string;
  vapidEnabled: boolean;
}

interface MapResponse {
  id: string;
  title: string;
  isPublished?: boolean;
}

interface PushStats {
  subscribers: number;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  body: string;
  targetPath: string | null;
  attempted: number;
  delivered: number;
  pruned: number;
  opened: number;
  sentAt: string;
  senderName: string | null;
}

interface BroadcastsResponse {
  items: BroadcastHistoryItem[];
}

const mapFetcher = (url: string): Promise<MapResponse> =>
  fetch(url).then((r) => r.json());

const broadcastsFetcher = (
  url: string,
): Promise<BroadcastsResponse> => fetch(url).then((r) => r.json());

const pushFetcher = (url: string): Promise<PushStats> =>
  fetch(url).then((r) => r.json());

/** Targets the broadcast deep-link picker offers. Keep tight — too
 *  many choices makes the picker noisy. Each maps to a real route on
 *  the public consumer site. */
const DEEPLINK_TARGETS = [
  { key: "home", label: "Home", path: "" },
  { key: "map", label: "Map", path: "/map" },
  { key: "events", label: "Events", path: "/events" },
  { key: "news", label: "News", path: "/news" },
  { key: "dining", label: "Dining", path: "/dining" },
  { key: "clubs", label: "Clubs", path: "/clubs" },
  { key: "klio", label: "Klio (ask)", path: "/klio" },
] as const;

const TITLE_MAX = 60;
const BODY_MAX = 160;

/**
 * Reach — the rector's outbound channel: publish state, the link +
 * QR they share with students, and the broadcast composer that pushes
 * to every installed device.
 *
 * Layout: two columns on lg+. Left pane is the work the rector did
 * today (publish + send a broadcast). Right pane is the shareable
 * artefact (URL + QR + subscriber count) — the things they hand to a
 * student, paste into a flyer, screenshot for slack. Keeping those
 * sides separate stopped the screen feeling like a dense form.
 *
 * Broadcast history with CTR is deferred — it needs a `Broadcast`
 * model that doesn't exist yet. The Send button reports the live
 * delivered / attempted / pruned counts via toast so the rector sees
 * what just happened.
 */
export default function CampusReachPageClient({
  orgId: _orgId,
  mapId,
  vapidEnabled,
}: Props) {
  const { data: map } = useSWR<MapResponse>(
    `/api/maps/${mapId}`,
    mapFetcher,
  );
  const { data: stats } = useSWR<PushStats>(
    `/api/maps/${mapId}/push-stats`,
    pushFetcher,
    { refreshInterval: 30_000 },
  );
  const { data: broadcasts } = useSWR<BroadcastsResponse>(
    `/api/maps/${mapId}/broadcasts`,
    broadcastsFetcher,
    { revalidateOnFocus: true },
  );

  const [target, setTarget] = useState<(typeof DEEPLINK_TARGETS)[number]["key"]>(
    "home",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return `/campus/${mapId}`;
    return `${window.location.origin}/campus/${mapId}`;
  }, [mapId]);

  const handleTogglePublish = async () => {
    if (!map || publishBusy) return;
    setPublishBusy(true);
    const next = !map.isPublished;
    try {
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });
      if (!res.ok) throw new Error("Failed");
      await globalMutate(`/api/maps/${mapId}`);
      toast.success(next ? "Campus is now public" : "Campus is now a draft");
    } catch {
      toast.error("Couldn't update visibility");
    } finally {
      setPublishBusy(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim() || sending) return;
    if (!vapidEnabled) {
      toast.error("Push notifications aren't configured on this server.");
      return;
    }
    setSending(true);
    try {
      const targetPath = DEEPLINK_TARGETS.find((t) => t.key === target)?.path ?? "";
      const res = await fetch(`/api/maps/${mapId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: `/campus/${mapId}${targetPath}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: { attempted: number; delivered: number; pruned: number };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Send failed");
      }
      toast.success(
        `Sent to ${data.result?.delivered ?? 0} of ${data.result?.attempted ?? 0} subscribers`,
      );
      setTitle("");
      setBody("");
      // Subscriber count may have shrunk if any endpoints were
      // pruned — refresh so the rector sees the live number.
      await Promise.all([
        globalMutate(`/api/maps/${mapId}/push-stats`),
        globalMutate(`/api/maps/${mapId}/broadcasts`),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  const isPublished = Boolean(map?.isPublished);
  const subscribers = stats?.subscribers ?? 0;
  const canSend = vapidEnabled && title.trim() && body.trim() && !sending;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Manage"
        title="Reach"
        subtitle="Publish state, the shareable link &amp; QR, and push broadcasts to every installed student."
        actions={<OpenPublicAction href={`/campus/${mapId}`} />}
      />

      {/* ─ Publish toggle ─────────────────────────────────────────── */}
      <Panel className="mb-6 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">
              Public visibility
            </h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {isPublished
                ? "Live — anyone with the link can open it."
                : "Draft — only authors can see it."}
            </p>
          </div>
          <Button
            size="sm"
            variant={isPublished ? "secondary" : "primary"}
            onClick={handleTogglePublish}
            disabled={publishBusy}
          >
            {publishBusy
              ? "…"
              : isPublished
                ? "Unpublish"
                : "Publish campus"}
          </Button>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ─ Left: outbound work ─────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <Panel className="rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Send size={16} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Send a broadcast
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Push to {subscribers.toLocaleString()} subscriber
                  {subscribers === 1 ? "" : "s"}. Optionally deep-link to any
                  campus surface — students tapping the notification land
                  exactly there.
                </p>
              </div>
            </div>

            {!vapidEnabled ? (
              <div className="mb-4 rounded-xl border border-line-soft bg-surface-2/40 px-4 py-3 text-xs text-text-tertiary">
                Push notifications aren&rsquo;t configured on this server.
                Set <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>,
                <code> VAPID_PRIVATE_KEY</code> and <code>VAPID_SUBJECT</code>{" "}
                in the environment to enable.
              </div>
            ) : null}

            <div className="space-y-4">
              <Field
                label="Title"
                hint={`${TITLE_MAX - title.length} characters left.`}
              >
                <Input
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value.slice(0, TITLE_MAX))
                  }
                  placeholder="Exam timetable is live"
                  maxLength={TITLE_MAX}
                  disabled={!vapidEnabled}
                />
              </Field>
              <Field
                label="Body"
                hint={`${BODY_MAX - body.length} characters left.`}
              >
                <Textarea
                  value={body}
                  onChange={(e) =>
                    setBody(e.target.value.slice(0, BODY_MAX))
                  }
                  placeholder="Tap to view the June exam schedule."
                  rows={3}
                  maxLength={BODY_MAX}
                  disabled={!vapidEnabled}
                />
              </Field>
              <Field label="Deep-link target">
                <Select
                  value={target}
                  onChange={(e) =>
                    setTarget(
                      e.target.value as (typeof DEEPLINK_TARGETS)[number]["key"],
                    )
                  }
                  disabled={!vapidEnabled}
                >
                  {DEEPLINK_TARGETS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  <Send size={12} strokeWidth={1.75} aria-hidden />
                  {sending ? "Sending…" : "Send broadcast"}
                </Button>
              </div>
            </div>
          </Panel>

          {/* ─ History ────────────────────────────────────────────── */}
          <Panel className="rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <History size={16} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Broadcast history
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Past broadcasts with delivered / attempted counts
                  and the share of recipients that tapped through.
                </p>
              </div>
            </div>
            <BroadcastHistoryList items={broadcasts?.items ?? null} />
          </Panel>
        </div>

        {/* ─ Right: the share card ──────────────────────────────── */}
        <aside className="space-y-6">
          <QrShare
            url={publicUrl}
            downloadFilename={`campus-${mapId}`}
            title="Share to students"
            subtitle="The link + QR you hand out. Survives printing — SVG download is sharp at any size."
            copyLabel="Copy URL"
          />

          <Panel className="rounded-2xl p-6">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Users size={16} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Subscribers
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Anonymous, by browser endpoint.
                </p>
              </div>
            </div>
            <div className="text-3xl font-light text-text-primary">
              {subscribers.toLocaleString()}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-tertiary">
              <Bell size={11} strokeWidth={1.75} aria-hidden />
              {vapidEnabled
                ? "Push enabled · live count"
                : "Push not configured"}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/**
 * Broadcast history rows — one per past send, newest first. Three
 * states: cold (null, render skeleton), empty (zero broadcasts ever),
 * populated. Delivery-rate pill highlights when a send underperformed
 * — anything below 80% is amber, below 50% is red — so a sudden drop
 * is obvious without parsing the raw counts.
 */
function BroadcastHistoryList({
  items,
}: {
  items: BroadcastHistoryItem[] | null;
}) {
  if (items === null) {
    return (
      <ul className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-16 animate-pulse rounded-xl bg-surface-2/60"
          />
        ))}
      </ul>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
        No broadcasts yet. The next one you send will show up here.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((b) => (
        <BroadcastHistoryRow key={b.id} item={b} />
      ))}
    </ul>
  );
}

function BroadcastHistoryRow({ item }: { item: BroadcastHistoryItem }) {
  const rate =
    item.attempted > 0
      ? Math.round((item.delivered / item.attempted) * 100)
      : null;
  const ratePill =
    rate === null
      ? "bg-text-tertiary/10 text-text-tertiary"
      : rate >= 80
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : rate >= 50
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-red-500/10 text-red-700 dark:text-red-300";

  return (
    <li className="rounded-xl border border-line-soft bg-surface-2/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {item.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-tertiary">
            {item.body}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${ratePill}`}
        >
          {item.delivered.toLocaleString()} / {item.attempted.toLocaleString()}
          {rate !== null ? <> &middot; {rate}%</> : null}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
        <time dateTime={item.sentAt}>{relative(item.sentAt)}</time>
        {item.opened > 0 ? (
          <>
            <span aria-hidden>&middot;</span>
            <span>
              {item.opened.toLocaleString()} opened
              {item.delivered > 0 ? (
                <>
                  {" "}
                  <span className="text-text-secondary">
                    ({Math.round((item.opened / item.delivered) * 100)}% CTR)
                  </span>
                </>
              ) : null}
            </span>
          </>
        ) : null}
        {item.targetPath ? (
          <>
            <span aria-hidden>&middot;</span>
            <span>
              <span className="text-text-secondary">target</span>{" "}
              <code className="font-mono">{item.targetPath}</code>
            </span>
          </>
        ) : null}
        {item.pruned > 0 ? (
          <>
            <span aria-hidden>&middot;</span>
            <span>{item.pruned} pruned</span>
          </>
        ) : null}
        {item.senderName ? (
          <>
            <span aria-hidden>&middot;</span>
            <span>by {item.senderName}</span>
          </>
        ) : null}
      </div>
    </li>
  );
}

/** Compact "Nm / Nh / Nd" relative time. Falls back to a localised
 *  date for anything older than a month. Mirrors the dashboard
 *  changes feed so the two surfaces read the same. */
function relative(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return "just now";
  if (ageMs < 60 * 60_000) return `${Math.floor(ageMs / 60_000)}m`;
  if (ageMs < 24 * 60 * 60_000) {
    return `${Math.floor(ageMs / (60 * 60_000))}h`;
  }
  if (ageMs < 7 * 24 * 60 * 60_000) {
    return `${Math.floor(ageMs / (24 * 60 * 60_000))}d`;
  }
  if (ageMs < 30 * 24 * 60 * 60_000) {
    return `${Math.floor(ageMs / (7 * 24 * 60 * 60_000))}w`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
