"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "klorad-campus-install-dismissed-at";
// How long to suppress the prompt after the visitor dismisses it.
// One install card is enough — we don't want to nag people back into
// the conversion path on every visit.
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * The `beforeinstallprompt` event Chromium fires when the page meets
 * PWA install criteria. The platform's type defs don't include it,
 * so we model it here. `prompt()` returns when the visitor picks
 * an option in the native sheet; `userChoice` resolves to the
 * outcome.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Floating "Install app" card that surfaces when the browser tells
 * us the site is installable. Renders nothing until then — no
 * placeholder, no layout reservation — so non-PWA browsers never see
 * it. Once shown, dismissing it hides the card for 14 days; an
 * accepted install hides it permanently for that browser.
 *
 * Sits above the bottom nav (`bottom-20`) on mobile so it doesn't
 * cover the four primary tabs.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = Number.parseInt(raw, 10);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
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
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
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
  }, []);

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
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // See above — storage failures are non-fatal.
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install this campus app"
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
        <p className="font-medium text-[var(--brand-text,#1a1a1a)]">
          Install this campus
        </p>
        <p className="text-xs text-[var(--brand-text-muted,#6b6b6b)]">
          Add to your home screen — opens like a native app.
        </p>
      </div>
      <button
        type="button"
        onClick={install}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-white"
        style={{ background: "var(--brand-primary, #534ab7)" }}
      >
        Install
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
