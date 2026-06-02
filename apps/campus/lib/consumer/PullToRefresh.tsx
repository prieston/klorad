"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Loader2 } from "lucide-react";

/** Distance the visitor has to pull before release triggers a refresh. */
const THRESHOLD = 64;
/** Maximum damped pull (rubbery feel past this). */
const MAX_PULL = 120;
/** Minimum spinner visibility so a sub-100ms refresh doesn't flash. */
const MIN_SPINNER_MS = 500;

/**
 * Pull-to-refresh — Instagram-style swipe-down gesture that triggers
 * `router.refresh()` to re-run the server components for the current
 * route. Mounted from the campus layout so every public surface
 * picks it up; opts out automatically inside the map's
 * `data-mappedin` viewport (the viewer eats vertical drags for
 * panning so the gesture would fight itself there).
 *
 * Lifecycle: track a `touchstart` while the page is scrolled to the
 * top; on `touchmove`, damp the downward delta into a render-able
 * pull distance; on `touchend` past the threshold, fire
 * `router.refresh()`. The spinner stays visible at least
 * MIN_SPINNER_MS so a fast refresh doesn't flicker.
 *
 * `preventDefault` on `touchmove` is gated to the active pull only —
 * otherwise normal horizontal scrolls / map gestures break.
 */
export function PullToRefresh() {
  const router = useRouter();
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
      router.refresh();
    } finally {
      // Keep the spinner visible for a minimum so the user actually
      // perceives the refresh — without this a fast route refresh
      // (cached SWR, no DB hit) hides the spinner before the eye
      // can register it.
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, wait);
    }
  }, [router]);

  useEffect(() => {
    const isOnMap = () => Boolean(document.querySelector("[data-mappedin]"));

    const onStart = (e: TouchEvent) => {
      if (refreshing || isOnMap()) return;
      if (window.scrollY > 0) return;
      // Only single-finger pulls — pinch-zoom etc shouldn't trigger.
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      if (window.scrollY > 0) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
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
  }, [refresh, refreshing]);

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
        // Smooth spring-back when we're done; no transition while the
        // finger is actively dragging.
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
            className="animate-spin text-[var(--brand-primary)]"
          />
        ) : (
          <ArrowDown
            size={16}
            strokeWidth={2}
            className={
              ready
                ? "text-[var(--brand-primary)]"
                : "text-[var(--brand-text-muted)]"
            }
          />
        )}
      </div>
    </div>
  );
}
