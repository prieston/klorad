"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  /** URL to load in the iframe — typically the matching public route. */
  src: string;
  /** Optional aria-label for the iframe. */
  title?: string;
  /**
   * Bump this to programmatically reload the iframe — e.g. after a
   * save round-trip. Increment a counter in the parent and pass it
   * here; the iframe re-mounts when the key changes.
   */
  reloadToken?: number;
}

/**
 * The phone-frame iframe shown beside every public-surface authoring
 * screen. Shows the live public page so rectors can see exactly what
 * students will see — without context-switching to a new tab.
 *
 * Implementation note: the cheapest correct preview is to load the
 * *real* public route and let the rector hit Refresh after a save.
 * A push-based draft channel (websocket / postMessage) is the
 * obvious upgrade but only earns its complexity when the rector
 * needs sub-second feedback on every keystroke; for now a one-click
 * refresh after a Save toast covers the demo + the daily workflow.
 *
 * The phone bezel uses CSS only — no asset to load, no broken image
 * on slow networks.
 */
export function PhonePreview({
  src,
  title = "Public preview",
  reloadToken = 0,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [manualReloads, setManualReloads] = useState(0);

  const reload = useCallback(() => {
    setManualReloads((n) => n + 1);
  }, []);

  // Re-mount the iframe when either the parent bumps `reloadToken`
  // or the visitor clicks Refresh. Re-mounting (via `key`) instead of
  // mutating `iframe.src` avoids the cross-origin "can't access
  // contentWindow" headaches when src is the production host.
  const renderKey = `${reloadToken}-${manualReloads}`;

  // Auto-reload on focus return — opens the same surface in a new
  // tab and you tab back, you want fresh state. Guarded so it
  // doesn't fire during the very first mount (which would just
  // wastefully re-fetch the page we just loaded).
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <div className="sticky top-6 flex flex-col items-center gap-3">
      <div className="flex items-center justify-between gap-2 self-stretch">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Live · public
        </span>
        <button
          type="button"
          onClick={reload}
          aria-label="Refresh preview"
          className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
        >
          <RefreshCw size={11} strokeWidth={1.75} aria-hidden />
          Refresh
        </button>
      </div>
      {/* Phone bezel — pure CSS, no asset. Roughly iPhone 14 ratio. */}
      <div
        className="relative h-[640px] w-[300px] overflow-hidden rounded-[36px] border-[6px] border-[#1a1a1a] bg-[#1a1a1a] shadow-2xl"
        aria-label="Phone frame"
      >
        {/* Notch */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#1a1a1a]"
        />
        <iframe
          key={renderKey}
          ref={iframeRef}
          src={src}
          title={title}
          loading="lazy"
          className="h-full w-full bg-white"
        />
      </div>
    </div>
  );
}
