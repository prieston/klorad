"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Native install card. Surfaces only when the browser fires
 * `beforeinstallprompt` (Chrome / Edge / Samsung Internet on
 * Android + desktop) and the visitor hasn't dismissed it this
 * session. iOS Safari + Firefox don't fire the event — the card
 * just never renders for them, which is the right outcome.
 *
 * The visitor's dismissal lives in sessionStorage so the card
 * doesn't nag them on every navigation inside the world. Per-world
 * scope (sessionStorage is per-origin, not per-tab) is good enough
 * for the v1 — installs are rare and we don't want to track them
 * cross-session.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    try {
      if (sessionStorage.getItem("klorad-world-install-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      /* storage disabled — show the prompt normally */
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!event || dismissed) return null;

  async function install() {
    if (!event) return;
    await event.prompt();
    try {
      await event.userChoice;
    } catch {
      /* user dismissed the system dialog */
    }
    setEvent(null);
  }

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem("klorad-world-install-dismissed", "1");
    } catch {
      /* storage disabled */
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1220]/95 px-4 py-3 text-white shadow-lg backdrop-blur">
        <Download size={16} strokeWidth={1.8} aria-hidden />
        <span className="text-xs font-medium">Install for offline + alerts</span>
        <button
          type="button"
          onClick={install}
          className="rounded-md bg-white px-3 py-1 text-[11px] font-semibold text-[#0b1220] transition-colors hover:bg-white/90"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="text-white/60 transition-colors hover:text-white"
        >
          <X size={14} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </div>
  );
}
