"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type Status =
  | "idle"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "subscribing"
  | "unsubscribing"
  | "error";

/** Where a subscribe attempt died. Surfaced as a button label and a
 *  structured console.warn so someone with DevTools open can tell
 *  us which awaitable stalled instead of guessing. Silent failure
 *  used to bury real bugs (bad VAPID key, SW that never activated,
 *  FCM unreachable) behind a button stuck at "Working…". */
type ErrorReason =
  | "sw-not-ready"
  | "sw-timeout"
  | "vapid-fetch"
  | "vapid-bad-key"
  | "push-subscribe"
  | "push-subscribe-timeout"
  | "subscribe-post"
  | "unknown";

interface Props {
  slug: string;
  primary: string;
}

const SW_READY_TIMEOUT_MS = 10_000;
const PUSH_SUBSCRIBE_TIMEOUT_MS = 15_000;

/**
 * Push notification opt-in for one world. Renders a small floating
 * button that mirrors the browser's permission state.
 *
 * Every await point has a timeout and an error label — silent hangs
 * used to bury real bugs behind a button stuck at "Working…". The
 * button now surfaces which step failed and the console carries the
 * underlying error.
 */
export function PushOptIn({ slug, primary }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<ErrorReason | null>(null);

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
    let cancelled = false;
    (async () => {
      try {
        const reg = await withTimeout(
          navigator.serviceWorker.ready,
          SW_READY_TIMEOUT_MS,
        );
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setStatus(existing ? "subscribed" : "idle");
      } catch (err) {
        if (cancelled) return;
        // Initial state check failing doesn't disable the button —
        // the operator can still try to subscribe, which surfaces
        // the real error.
        console.warn("[PushOptIn] initial state check failed", err);
        setStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setStatus("subscribing");
    setErrorReason(null);
    let step: ErrorReason = "unknown";
    try {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus(perm === "denied" ? "denied" : "idle");
          return;
        }
      }

      step = "vapid-fetch";
      const keyRes = await fetch(`/api/public/worlds/${slug}/vapid-public-key`);
      if (!keyRes.ok) {
        console.warn(
          `[PushOptIn] vapid endpoint ${keyRes.status} — push not available`,
        );
        setStatus("unsupported");
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      if (!publicKey) {
        step = "vapid-bad-key";
        throw new Error("vapid endpoint returned no key");
      }

      step = "sw-not-ready";
      const reg = await withTimeout(
        navigator.serviceWorker.ready,
        SW_READY_TIMEOUT_MS,
      ).catch((err) => {
        step = "sw-timeout";
        throw err;
      });

      step = "push-subscribe";
      const sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        }),
        PUSH_SUBSCRIBE_TIMEOUT_MS,
      ).catch((err) => {
        step = "push-subscribe-timeout";
        throw err;
      });

      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh ?? "";
      const auth = subJson.keys?.auth ?? "";
      if (!p256dh || !auth || !sub.endpoint) {
        await sub.unsubscribe();
        setStatus("idle");
        return;
      }

      step = "subscribe-post";
      const anonId = readAnonId();
      const res = await fetch(`/api/public/worlds/${slug}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth, anonId }),
      });
      if (!res.ok) {
        console.warn(
          `[PushOptIn] subscribe POST ${res.status}`,
          await res.text().catch(() => ""),
        );
        await sub.unsubscribe();
        setErrorReason(step);
        setStatus("error");
        return;
      }
      setStatus("subscribed");
    } catch (err) {
      console.warn(`[PushOptIn] subscribe failed at step: ${step}`, err);
      setErrorReason(step);
      setStatus("error");
    }
  }, [slug]);

  const unsubscribe = useCallback(async () => {
    setStatus("unsubscribing");
    try {
      const reg = await withTimeout(
        navigator.serviceWorker.ready,
        SW_READY_TIMEOUT_MS,
      );
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
    } catch (err) {
      console.warn("[PushOptIn] unsubscribe failed", err);
      setStatus("idle");
    }
  }, [slug]);

  if (status === "unsupported" || status === "denied") return null;

  const subscribed = status === "subscribed" || status === "unsubscribing";
  const busy = status === "subscribing" || status === "unsubscribing";
  const errored = status === "error";
  const onClick = subscribed ? unsubscribe : subscribe;
  const Icon = subscribed ? Bell : BellOff;
  const label = subscribed
    ? "Alerts on"
    : busy
      ? "Working…"
      : errored
        ? `Retry (${friendlyReason(errorReason)})`
        : "Enable alerts";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={subscribed}
      title={
        errored
          ? "Subscribe failed. Open DevTools console for the underlying error."
          : undefined
      }
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition-colors disabled:opacity-60"
      style={
        subscribed
          ? {
              borderColor: primary,
              color: primary,
              backgroundColor: "var(--w-accent-soft)",
            }
          : errored
            ? {
                borderColor: "#ef4444",
                color: "#ef4444",
                backgroundColor: "var(--w-overlay)",
              }
            : {
                borderColor: "var(--w-border-strong)",
                color: "var(--w-fg)",
                backgroundColor: "var(--w-overlay)",
              }
      }
    >
      <Icon size={12} strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}

/** Race an awaitable against a wall clock so an unresponsive browser
 *  API (SW that never activates, FCM that never answers) surfaces as
 *  an explicit failure instead of a UI that pretends to work. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function friendlyReason(reason: ErrorReason | null): string {
  switch (reason) {
    case "sw-not-ready":
    case "sw-timeout":
      return "SW";
    case "vapid-fetch":
      return "vapid";
    case "vapid-bad-key":
      return "key";
    case "push-subscribe":
    case "push-subscribe-timeout":
      return "subscribe";
    case "subscribe-post":
      return "server";
    default:
      return "error";
  }
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
