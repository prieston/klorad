"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  BellOff,
  ChevronDown,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";

interface Props {
  slug: string;
}

type NotificationState = "loading" | "unsupported" | "denied" | "off" | "on";

async function findWorldRegistration(
  slug: string,
): Promise<ServiceWorkerRegistration | null> {
  const scope = new URL(`/w/${slug}/`, window.location.origin).href;
  const all = await navigator.serviceWorker.getRegistrations();
  return all.find((r) => r.scope === scope) ?? null;
}

/**
 * Settings dropdown mounted in the world's top nav. Serves three
 * jobs in one condensed surface:
 *
 * 1. **Identity** — shows the signed-in user (name/email) or a
 *    Sign-in link that comes back to this world on completion.
 * 2. **Notifications toggle** — reads the current push subscription
 *    state, offers Enable / Disable + falls back to a "Blocked by
 *    browser" hint when Notification.permission === "denied". Uses
 *    the same VAPID key + subscribe endpoint as the floating
 *    PushOptIn pill on the Map tab; both stay in sync via the
 *    browser's subscription store.
 * 3. **Sign out** — one-click, returns to the world's public root.
 *
 * The menu closes on outside-click and Escape. Positioned below
 * the trigger with `right-0` so it never overflows the viewport on
 * narrow phones.
 */
export function MobilitySettingsMenu({ slug }: Props) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [notifState, setNotifState] = useState<NotificationState>("loading");
  const [notifBusy, setNotifBusy] = useState(false);

  // Read the current subscription state on mount. We poll this on
  // every open so the toggle reflects changes made from the
  // floating PushOptIn pill without a full page refresh.
  const readState = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setNotifState("denied");
      return;
    }
    try {
      const reg = await findWorldRegistration(slug);
      if (!reg) {
        setNotifState("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setNotifState(sub ? "on" : "off");
    } catch {
      setNotifState("unsupported");
    }
  }, [slug]);

  useEffect(() => {
    void readState();
  }, [readState]);

  useEffect(() => {
    if (!open) return;
    void readState();
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, readState]);

  const toggleNotifications = async () => {
    if (notifBusy) return;
    setNotifBusy(true);
    try {
      if (notifState === "on") {
        // Unsubscribe.
        const reg = await findWorldRegistration(slug);
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await fetch(`/api/public/worlds/${slug}/unsubscribe`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => undefined);
          await sub.unsubscribe();
        }
        setNotifState("off");
        return;
      }
      // Subscribe.
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setNotifState(perm === "denied" ? "denied" : "off");
          return;
        }
      }
      const keyRes = await fetch(`/api/public/worlds/${slug}/vapid-public-key`);
      if (!keyRes.ok) {
        setNotifState("unsupported");
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      const reg = await findWorldRegistration(slug);
      if (!reg) {
        setNotifState("unsupported");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh ?? "";
      const auth = subJson.keys?.auth ?? "";
      if (!p256dh || !auth || !sub.endpoint) {
        await sub.unsubscribe();
        return;
      }
      const res = await fetch(`/api/public/worlds/${slug}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        return;
      }
      setNotifState("on");
    } catch (err) {
      console.warn("[MobilitySettingsMenu] notification toggle failed", err);
    } finally {
      setNotifBusy(false);
    }
  };

  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(`/w/${slug}`)}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Settings"
        className="inline-flex items-center gap-1 rounded-full border border-[var(--w-border,#e6e6ea)] bg-white px-2.5 py-1.5 text-[var(--w-fg,#1a1a1a)] transition-colors hover:border-[var(--w-accent,#0ea5e9)]"
      >
        <Settings size={14} strokeWidth={1.8} />
        <ChevronDown size={12} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-2xl border border-[var(--w-border,#e6e6ea)] bg-white shadow-lg"
        >
          {/* Identity */}
          <div className="border-b border-[var(--w-border,#e6e6ea)] px-4 py-3">
            {authStatus === "loading" ? (
              <p className="text-xs text-[var(--w-fg-muted,#6b6b6b)]">…</p>
            ) : session?.user ? (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--w-page,#f5f5f7)] text-[var(--w-accent,#0ea5e9)]"
                >
                  <UserIcon size={14} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--w-fg,#1a1a1a)]">
                    {session.user.name ?? session.user.email ?? "Signed in"}
                  </span>
                  {session.user.name && session.user.email && (
                    <span className="block truncate text-[10px] text-[var(--w-fg-muted,#6b6b6b)]">
                      {session.user.email}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <Link
                href={signInHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--w-accent,#0ea5e9)]"
                onClick={() => setOpen(false)}
              >
                <LogIn size={14} strokeWidth={1.8} />
                Sign in
              </Link>
            )}
          </div>

          {/* Notifications */}
          <button
            type="button"
            role="menuitem"
            onClick={() => void toggleNotifications()}
            disabled={
              notifBusy ||
              notifState === "loading" ||
              notifState === "unsupported" ||
              notifState === "denied"
            }
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--w-page,#f5f5f7)] disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--w-page,#f5f5f7)]"
              >
                {notifState === "on" ? (
                  <Bell size={13} strokeWidth={2} className="text-[var(--w-accent,#0ea5e9)]" />
                ) : (
                  <BellOff size={13} strokeWidth={2} className="text-[var(--w-fg-muted,#6b6b6b)]" />
                )}
              </span>
              <span className="text-sm text-[var(--w-fg,#1a1a1a)]">
                Notifications
              </span>
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--w-fg-muted,#6b6b6b)]">
              {notifState === "on"
                ? "On"
                : notifState === "denied"
                  ? "Blocked"
                  : notifState === "unsupported"
                    ? "N/A"
                    : notifBusy
                      ? "…"
                      : "Off"}
            </span>
          </button>

          {/* Sign out */}
          {session?.user && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut({ callbackUrl: `/w/${slug}` }).then(() => {
                  router.refresh();
                });
              }}
              className="flex w-full items-center gap-3 border-t border-[var(--w-border,#e6e6ea)] px-4 py-3 text-left transition-colors hover:bg-[var(--w-page,#f5f5f7)]"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--w-page,#f5f5f7)]"
              >
                <LogOut size={13} strokeWidth={2} className="text-[var(--w-fg-muted,#6b6b6b)]" />
              </span>
              <span className="text-sm text-[var(--w-fg,#1a1a1a)]">Sign out</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Duplicated from PushOptIn — kept local so this menu can subscribe
 *  without importing across a client-component boundary that also
 *  ships the map viewer. Small enough that it's not worth extracting
 *  to a shared util yet. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
