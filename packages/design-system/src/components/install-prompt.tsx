"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/** How long to suppress the prompt after the visitor dismisses it —
 *  matches the platform norm of "asked, we back off for a fortnight". */
const DEFAULT_DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The `beforeinstallprompt` event Chromium fires when the page meets
 * PWA install criteria. The DOM lib doesn't type it, so we model it
 * here. `prompt()` returns when the visitor picks an option in the
 * native sheet; `userChoice` resolves to the outcome.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallPromptProps {
  /** LocalStorage key used to persist the dismiss timestamp. Each app
   *  passes its own so Campus dismiss and Mobility dismiss don't
   *  collide. */
  storageKey: string;
  /** Card title. Default: "Install this app". */
  title?: string;
  /** Card subtitle. Default: "Add to your home screen — opens like a
   *  native app." */
  subtitle?: string;
  /** Label on the install button. Default: "Install". */
  installLabel?: string;
  /** Dismiss suppression window. Default: 14 days. */
  dismissTtlMs?: number;
}

/**
 * Floating "Install app" card that surfaces when the browser tells
 * us the site is installable. Renders nothing until then — no
 * placeholder, no layout reservation — so non-PWA browsers never see
 * it. Once shown, dismissing it hides the card for `dismissTtlMs`;
 * an accepted install hides it permanently for that browser.
 *
 * Sits above a bottom nav (`bottom-20`) on mobile so it doesn't
 * cover the primary tabs; on desktop it pins to the bottom-right.
 * Colour comes from CSS custom properties (`--brand-primary`,
 * `--brand-primary-bg`, `--brand-text`, `--brand-text-muted`,
 * `--brand-line`) so each app inherits its palette.
 */
export function InstallPrompt({
  storageKey,
  title = "Install this app",
  subtitle = "Add to your home screen — opens like a native app.",
  installLabel = "Install",
  dismissTtlMs = DEFAULT_DISMISS_TTL_MS,
}: InstallPromptProps) {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const ts = Number.parseInt(raw, 10);
        if (Number.isFinite(ts) && Date.now() - ts < dismissTtlMs) {
          return;
        }
      }
    } catch {
      // Private mode / storage disabled — fall through and show the
      // prompt anyway. The browser still respects the install state.
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setEvent(null);
      setVisible(false);
      try {
        localStorage.setItem(storageKey, String(Date.now()));
      } catch {
        // Storage failures are non-fatal — the browser tracks the
        // installed state itself, so the prompt won't re-fire.
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [storageKey, dismissTtlMs]);

  if (!visible || !event) return null;

  const install = async () => {
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      setEvent(null);
      setVisible(false);
    }
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // See above — storage failures are non-fatal.
    }
  };

  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[var(--brand-line,#e6e6ea)] bg-white px-4 py-3 shadow-lg md:bottom-4 md:left-auto md:right-4"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--brand-primary-bg, #f1eef9)" }}
        aria-hidden
      >
        <Download
          size={18}
          strokeWidth={1.75}
          style={{ color: "var(--brand-primary, #534ab7)" }}
        />
      </div>
      <div className="flex-1 text-sm">
        <p className="font-medium text-[var(--brand-text,#1a1a1a)]">{title}</p>
        <p className="text-xs text-[var(--brand-text-muted,#6b6b6b)]">
          {subtitle}
        </p>
      </div>
      <button
        type="button"
        onClick={install}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
        style={{ background: "var(--brand-primary, #534ab7)" }}
      >
        {installLabel}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="rounded-full p-1 text-[var(--brand-text-muted,#6b6b6b)] hover:bg-[var(--brand-primary-bg,#f1eef9)]"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
