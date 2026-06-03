"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import QRCode from "qrcode";
import {
  Bell,
  Check,
  Copy,
  Download,
  History,
  QrCode,
  Send,
  Users,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
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

const mapFetcher = (url: string): Promise<MapResponse> =>
  fetch(url).then((r) => r.json());

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

  const [target, setTarget] = useState<(typeof DEEPLINK_TARGETS)[number]["key"]>(
    "home",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return `/campus/${mapId}`;
    return `${window.location.origin}/campus/${mapId}`;
  }, [mapId]);

  // Render the QR client-side when the URL is known. SVG is sharp
  // at any zoom and downloads as a file the rector can drop into
  // print or paste into Figma without rasterising. `level: 'M'` is
  // the sweet spot between resilience and dot density at typical
  // student-phone scan distance.
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(publicUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      width: 240,
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const handleDownloadQr = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename includes the mapId so the rector can save multiple
    // campus QRs without overwriting in their Downloads folder.
    a.download = `campus-${mapId}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
      await globalMutate(`/api/maps/${mapId}/push-stats`);
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

          {/* ─ History placeholder ───────────────────────────────── */}
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
                  Past broadcasts and their delivered / CTR counts.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
              History lands once we persist broadcasts to a model.
            </div>
          </Panel>
        </div>

        {/* ─ Right: the share card ──────────────────────────────── */}
        <aside className="space-y-6">
          <Panel className="rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <QrCode size={16} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Share to students
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  The link + QR you hand out. Survives printing — SVG
                  download is sharp at any size.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div
                className="flex h-48 w-48 items-center justify-center rounded-xl bg-white p-2 shadow-sm"
                aria-label="QR code"
                dangerouslySetInnerHTML={
                  qrSvg
                    ? { __html: qrSvg }
                    : { __html: "<div style='color:#9ca3af;font-size:11px'>Generating…</div>" }
                }
              />
              <div className="w-full text-center">
                <div className="truncate font-mono text-xs text-text-secondary">
                  {publicUrl}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2">
                <Button size="sm" variant="secondary" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check size={12} strokeWidth={1.75} aria-hidden />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} strokeWidth={1.75} aria-hidden />
                      Copy URL
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadQr}
                  disabled={!qrSvg}
                >
                  <Download size={12} strokeWidth={1.75} aria-hidden />
                  Download QR
                </Button>
              </div>
            </div>
          </Panel>

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
