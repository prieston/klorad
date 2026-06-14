"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type Status =
  | "idle"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "subscribing"
  | "unsubscribing";

interface Props {
  slug: string;
  primary: string;
}

/**
 * Push notification opt-in for one world. Renders a small floating
 * button that mirrors the browser's permission state:
 *
 *   - SW not supported / iOS Safari without standalone install
 *     → render nothing (no nag)
 *   - Permission "denied" → render nothing (the browser blocked us;
 *     surfacing a button would be cargo-cult)
 *   - Default → "Enable alerts" — clicks subscribe through SW + post
 *   - Granted + subscribed → "Alerts on" — clicks unsubscribe
 *
 * Lives client-side because the Notification API doesn't exist on the
 * server, and the SW registration must be ready before subscribing —
 * the registrar in the layout already triggers that on mount; we just
 * wait for it via `serviceWorker.ready`.
 */
export function PushOptIn({ slug, primary }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    // Check existing subscription so the button reflects state on
    // revisit instead of saying "Enable" when the user has already
    // opted in on a previous session.
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setStatus(existing ? "subscribed" : "idle");
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setStatus("subscribing");
    try {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus(perm === "denied" ? "denied" : "idle");
          return;
        }
      }

      const keyRes = await fetch(`/api/public/worlds/${slug}/vapid-public-key`);
      if (!keyRes.ok) {
        // Push not configured — silently revert. The UI already
        // hides the button when we can detect this earlier, but
        // network ordering means we may discover it here.
        setStatus("unsupported");
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // `applicationServerKey` is typed as `BufferSource`, but TS's
        // lib.dom narrows it through ArrayBufferView<ArrayBuffer>,
        // which rejects Uint8Array's `ArrayBufferLike` slot. The
        // runtime accepts plain Uint8Array — cast through unknown
        // rather than ship a slice that allocates twice.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh ?? "";
      const auth = subJson.keys?.auth ?? "";
      if (!p256dh || !auth || !sub.endpoint) {
        await sub.unsubscribe();
        setStatus("idle");
        return;
      }

      const anonId = readAnonId();
      const res = await fetch(`/api/public/worlds/${slug}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth, anonId }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        setStatus("idle");
        return;
      }
      setStatus("subscribed");
    } catch {
      setStatus("idle");
    }
  }, [slug]);

  const unsubscribe = useCallback(async () => {
    setStatus("unsubscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const anonId = readAnonId();
        await fetch(`/api/public/worlds/${slug}/unsubscribe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint, anonId }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setStatus("idle");
    } catch {
      setStatus("idle");
    }
  }, [slug]);

  if (status === "unsupported" || status === "denied") return null;

  const subscribed = status === "subscribed" || status === "unsubscribing";
  const busy = status === "subscribing" || status === "unsubscribing";
  const onClick = subscribed ? unsubscribe : subscribe;
  const Icon = subscribed ? Bell : BellOff;
  const label = subscribed
    ? "Alerts on"
    : busy
      ? "Working…"
      : "Enable alerts";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={subscribed}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
      style={subscribed ? { borderColor: primary, color: primary } : undefined}
    >
      <Icon size={12} strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}

/** Read the same anonId the WorldBeacon writes — undefined when
 *  storage is disabled or before the beacon has run. */
function readAnonId(): string | undefined {
  try {
    return window.localStorage.getItem("klorad-mobility-anon") ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convert a base64-url-encoded VAPID key (the shape `web-push` emits)
 * to the `Uint8Array` Chrome / Firefox PushManager wants.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
