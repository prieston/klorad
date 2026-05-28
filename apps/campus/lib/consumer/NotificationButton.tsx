"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

export interface NotificationButtonProps {
  mapId: string;
  /** VAPID public key — exposed via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. */
  vapidPublicKey?: string;
}

/** "BAi…" URL-safe base64 → Uint8Array as the Push API expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Bell button that opts the visitor in to push notifications for a
 * campus. Renders nothing when the browser doesn't support service
 * workers / push, or when the server hasn't shipped a VAPID public
 * key — the silent-disable cases. When it does render, the bell
 * shows the current state (subscribed / unsubscribed) and tapping
 * toggles.
 *
 * No identity is sent — only the browser's anonymous push endpoint
 * + the two keys the Push API exposes, scoped to the campus's
 * project id.
 */
export function NotificationButton({
  mapId,
  vapidPublicKey,
}: NotificationButtonProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      Boolean(vapidPublicKey);
    setSupported(ok);
    if (!ok) return;

    // Check whether we're already subscribed (no prompt fires).
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setEnabled(Boolean(sub));
      } catch {
        setEnabled(false);
      }
    })();
  }, [vapidPublicKey]);

  if (supported === null || supported === false) return null;

  const enable = async () => {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      // Browsers prompt for Notification permission on `subscribe`.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // TS quirk: PushManager's typings want a fresh ArrayBuffer,
        // not the `Uint8Array<ArrayBufferLike>` Node-flavoured TS
        // hands us. The runtime accepts either; the cast is safe.
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as unknown as BufferSource,
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh: string; auth: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: mapId,
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error("Failed to register");
      setEnabled(true);
    } catch (err) {
      console.error("[push] enable failed", err);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: mapId, endpoint }),
        });
      }
      setEnabled(false);
    } catch (err) {
      console.error("[push] disable failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void (enabled ? disable() : enable())}
      disabled={busy}
      aria-pressed={enabled}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-line)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)] disabled:opacity-60"
    >
      {enabled ? (
        <>
          <Bell size={14} strokeWidth={1.75} className="text-[var(--brand-primary)]" />
          Notifications on
        </>
      ) : (
        <>
          <BellOff size={14} strokeWidth={1.75} />
          Get notifications
        </>
      )}
    </button>
  );
}
