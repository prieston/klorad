"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";

/** Distance the visitor has to pull before release triggers a refresh. */
const THRESHOLD = 64;
/** Maximum damped pull (rubbery feel past this). */
const MAX_PULL = 120;
/** Minimum spinner visibility so a sub-100ms refresh doesn't flash. */
const MIN_SPINNER_MS = 500;

export interface PullToRefreshProps {
  /**
   * Called when the visitor releases past the threshold. The primitive
   * keeps the spinner visible for at least `MIN_SPINNER_MS` so a fast
   * refresh (e.g. cached SWR) doesn't flicker.
   *
   * Verticals typically pass `router.refresh` (Next.js App Router).
   */
  onRefresh: () => void | Promise<void>;
  /**
   * CSS selector for containers that should suppress the gesture —
   * usually a map viewer that eats vertical drags for panning. Falsy
   * or empty means the gesture is always active.
   *
   * Defaults to `"[data-mappedin]"` for Campus back-compat; Mobility
   * uses `"[data-mapbox]"` for its Mapbox surfaces.
   */
  optOutSelector?: string;
}

/**
 * Pull-to-refresh — Instagram-style swipe-down gesture at the top of
 * the page. When the visitor pulls past the threshold and releases,
 * `onRefresh` fires; a spinner stays visible for the minimum time so
 * the refresh registers even when the underlying work is instant.
 *
 * Lifecycle: track `touchstart` while `scrollY === 0`; on `touchmove`,
 * damp the downward delta into a render-able pull distance; on
 * `touchend` past `THRESHOLD`, fire the caller's `onRefresh`.
 *
 * `preventDefault` on `touchmove` is gated to the active pull only —
 * otherwise normal horizontal scrolls and map gestures break.
 *
 * Colour comes from CSS custom properties `--brand-primary` and
 * `--brand-text-muted` (same convention as the rest of the DS), so
 * each app inherits its palette without prop-drilling.
 */
export function PullToRefresh({
  onRefresh,
  optOutSelector = "[data-mappedin]",
}: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs survive renders without re-binding the touch listeners.
  const startY = useRef(0);
  const pulling = useRef(false);
  // Read `pull` inside the touch handlers without re-binding them.
  const pullRef = useRef(0);
  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const started = Date.now();
    try {
      await onRefresh();
    } finally {
      // Keep the spinner visible for a minimum so the visitor
      // actually perceives the refresh — without this a fast route
      // refresh (cached SWR, no DB hit) hides the spinner before the
      // eye can register it.
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, wait);
    }
  }, [onRefresh]);

  useEffect(() => {
    const isOptedOut = () =>
      optOutSelector ? Boolean(document.querySelector(optOutSelector)) : false;

    const onStart = (e: TouchEvent) => {
      if (refreshing || isOptedOut()) return;
      if (window.scrollY > 0) return;
      // Only single-finger pulls — pinch-zoom etc shouldn't trigger.
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0]!.clientY;
      pulling.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      if (window.scrollY > 0) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const delta = e.touches[0]!.clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Damped curve — past MAX_PULL we just don't grow any further
      // so the pull feels like it's hitting a soft wall.
      const damped = Math.min(MAX_PULL, delta * 0.55);
      setPull(damped);
      // Stop iOS's native rubber-band while we own the gesture.
      // Only call when the listener was registered non-passive.
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullRef.current >= THRESHOLD) {
        void refresh();
      } else {
        setPull(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    // touchmove must be non-passive so preventDefault works.
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refresh, refreshing, optOutSelector]);

  if (!refreshing && pull === 0) return null;

  const ready = pull >= THRESHOLD;
  const visibleHeight = refreshing ? 56 : Math.max(pull, 0);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: visibleHeight,
        // Smooth spring-back when we're done; no transition while
        // the finger is actively dragging.
        transition: refreshing || pull === 0 ? "height 220ms ease" : "none",
        pointerEvents: "none",
        zIndex: 30,
      }}
      className="flex items-end justify-center pb-2"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md"
        style={{
          transform: refreshing
            ? "none"
            : `rotate(${Math.min(180, (pull / THRESHOLD) * 180)}deg)`,
          transition: "transform 80ms linear",
        }}
      >
        {refreshing ? (
          <Loader2
            size={16}
            strokeWidth={2}
            className="animate-spin"
            style={{ color: "var(--brand-primary, #534ab7)" }}
          />
        ) : (
          <ArrowDown
            size={16}
            strokeWidth={2}
            style={{
              color: ready
                ? "var(--brand-primary, #534ab7)"
                : "var(--brand-text-muted, #6b6b6b)",
            }}
          />
        )}
      </div>
    </div>
  );
}
