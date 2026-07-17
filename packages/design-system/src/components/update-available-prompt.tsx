"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/** Post-message type the SW listens for to activate a waiting worker. */
export const SKIP_WAITING_MESSAGE = "klorad-skip-waiting" as const;

export interface UpdateAvailablePromptProps {
  /**
   * SW scope this prompt watches. Verticals with per-tenant SWs pass
   * the scope they registered with (e.g. `/w/<slug>/` for a Mobility
   * world) so the hook picks the right registration. Falsy = use
   * `serviceWorker.ready` (single-scope apps).
   */
  scope?: string;
  /** Card title. Default: "New version available". */
  title?: string;
  /** Card subtitle. Default: "Refresh to load the latest updates." */
  subtitle?: string;
  /** Refresh button label. Default: "Refresh". */
  refreshLabel?: string;
}

/**
 * "New version available — refresh" prompt tied to the service
 * worker update flow. Shows when the SW has a `waiting` worker (a
 * new version installed but not yet activated). Accepting the
 * prompt posts `{type: "klorad-skip-waiting"}` to the waiting
 * worker, which must respond by calling `self.skipWaiting()` and
 * then the page reloads once the new worker takes control.
 *
 * **SW-side responsibility (in your `public/sw.js`):**
 *
 * ```js
 * self.addEventListener("message", (event) => {
 *   if (event.data && event.data.type === "klorad-skip-waiting") {
 *     self.skipWaiting();
 *   }
 * });
 * ```
 *
 * Without that handler, the button spins forever — the SW ignores
 * the message and never activates.
 *
 * Palette comes from the standard `--brand-*` CSS vars (see
 * `InstallPrompt` for the full list).
 */
export function UpdateAvailablePrompt({
  scope,
  title = "New version available",
  subtitle = "Refresh to load the latest updates.",
  refreshLabel = "Refresh",
}: UpdateAvailablePromptProps) {
  const [waitingWorker, setWaitingWorker] =
    useState<ServiceWorker | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const attachToRegistration = (reg: ServiceWorkerRegistration) => {
      // A worker may already be waiting from a prior visit.
      if (reg.waiting) setWaitingWorker(reg.waiting);
      // …or land during this session.
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // "Installed" while there's an existing controller = an
            // update is now waiting for skip-waiting.
            setWaitingWorker(installing);
          }
        });
      });
    };

    const findRegistration = async () => {
      if (scope) {
        const scopeUrl = new URL(scope, window.location.origin).href;
        const all = await navigator.serviceWorker.getRegistrations();
        return all.find((r) => r.scope === scopeUrl) ?? null;
      }
      return navigator.serviceWorker.ready;
    };

    void findRegistration().then((reg) => {
      if (cancelled || !reg) return;
      attachToRegistration(reg);
    });

    // When the new SW takes control, reload the page so the fresh
    // assets kick in without a stale bundle mismatch.
    const onControllerChange = () => {
      if (refreshing) window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, [scope, refreshing]);

  const refresh = useCallback(() => {
    if (!waitingWorker) return;
    setRefreshing(true);
    waitingWorker.postMessage({ type: SKIP_WAITING_MESSAGE });
    // `controllerchange` will reload the page when the new worker
    // takes over. Fallback in case the SW misses the message (dev SW,
    // hand-rolled without the message handler): reload after 2s.
    window.setTimeout(() => {
      if (refreshing) window.location.reload();
    }, 2000);
  }, [waitingWorker, refreshing]);

  const dismiss = useCallback(() => {
    setWaitingWorker(null);
  }, []);

  if (!waitingWorker) return null;

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
        <RefreshCw
          size={18}
          strokeWidth={1.75}
          style={{ color: "var(--brand-primary, #534ab7)" }}
          className={refreshing ? "animate-spin" : undefined}
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
        onClick={refresh}
        disabled={refreshing}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        style={{ background: "var(--brand-primary, #534ab7)" }}
      >
        {refreshing ? "Refreshing…" : refreshLabel}
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
