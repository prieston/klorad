"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { ViewerCanvas } from "@/lib/heritage/ui/ViewerCanvas";

interface Stop {
  id: string;
  title: string;
  body: string | null;
  cameraPose: {
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
  } | null;
  layers: { id: string; url: string; transform?: unknown }[];
  href: string | null;
  contextLabel: string | null;
}

/**
 * Walks a visitor through a tour.
 *
 * Two decisions shape this component.
 *
 * **Consecutive stops in the same scene do not reload.** A tour usually moves
 * around one model, and tearing down the WebGL context between stops would
 * re-download the geometry each time — turning a smooth walk into a series of
 * loading spinners on exactly the connection least able to afford it. Stops
 * are grouped by the set of layers they show, and the viewer is only remounted
 * when that set actually changes.
 *
 * **The stop lives in the URL.** `?stop=3` is shareable, survives a refresh,
 * and gives the back button the meaning a visitor expects. A tour someone
 * cannot link a friend to the middle of is a slideshow.
 */
export function TourPlayer({
  stops,
  initialStop,
  querystringLang,
  basePath,
  strings,
}: {
  stops: Stop[];
  initialStop: number;
  language: string;
  querystringLang: string | null;
  basePath: string;
  strings: {
    stopOf: string;
    previous: string;
    next: string;
    endOfTour: string;
    allStops: string;
    readMore: string;
    viewer: { loading: string; failed: string; hint: string };
    modelLabel: string;
    noGeometry: string;
  };
}) {
  const [index, setIndex] = useState(initialStop);
  const viewerRef = useRef<{
    flyTo?: (pose: {
      position: [number, number, number];
      target?: [number, number, number];
      fov?: number;
    }) => void;
  } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = stops[index];

  // Identity of the geometry on screen. Stops sharing this string share a
  // viewer instance and never trigger a reload.
  const layerKey = useMemo(
    () => current?.layers.map((l) => l.url).join("|") ?? "",
    [current],
  );

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(stops.length - 1, next));
      setIndex(clamped);

      const params = new URLSearchParams();
      if (querystringLang) params.set("lang", querystringLang);
      if (clamped > 0) params.set("stop", String(clamped + 1));
      const qs = params.toString();

      // `replaceState` rather than a router push: a tour is one page being
      // read, and pushing would bury the venue behind a dozen history entries
      // the back button has to climb.
      window.history.replaceState(null, "", qs ? `${basePath}?${qs}` : basePath);
    },
    [basePath, querystringLang, stops.length],
  );

  // Move focus to the new stop's heading. Without this a keyboard or screen
  // reader user presses Next and focus stays on a button whose surrounding
  // content silently changed.
  useEffect(() => {
    if (index !== initialStop) headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Fly to the authored viewpoint whenever the stop changes within one scene.
  useEffect(() => {
    const pose = current?.cameraPose;
    if (!pose?.position) return;
    if (!pose.position) return;
    const position = pose.position;
    const id = window.setTimeout(() => {
      viewerRef.current?.flyTo?.({ position, target: pose.target, fov: pose.fov });
    }, 80);
    return () => window.clearTimeout(id);
  }, [current, layerKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never hijack arrows inside the viewer, which uses them to step through
      // points of interest, or inside a form control.
      if (target?.closest("input, textarea, select, [role='application']")) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  if (!current) return null;

  const atEnd = index === stops.length - 1;

  return (
    <section className="mt-8">
      {/* Progress. Segments rather than a bar: a visitor deciding whether to
          start wants to know it is eight stops, not "37% complete". */}
      <ol
        aria-label={strings.allStops}
        className="mb-4 flex flex-wrap items-center gap-1.5"
      >
        {stops.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === index ? "step" : undefined}
              aria-label={`${i + 1}. ${s.title}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-accent"
                  : i < index
                    ? "w-4 bg-accent/40 hover:bg-accent/70"
                    : "w-4 bg-surface-2 hover:bg-line-strong"
              }`}
            />
          </li>
        ))}
      </ol>

      {current.layers.length > 0 ? (
        <ViewerCanvas
          // Keyed on the geometry, not the stop: moving between two stops of
          // the same scene keeps the loaded model and only flies the camera.
          key={layerKey}
          onViewerReady={(v) => {
            viewerRef.current = v;
            // The first stop's viewpoint is applied without animation: there
            // is no previous position to fly from, and a swoop out of the
            // default framing would look like a bug.
            const pose = current.cameraPose;
            if (pose?.position) {
              v.flyTo(
                { position: pose.position, target: pose.target, fov: pose.fov },
                { animate: false },
              );
            }
          }}
          layers={current.layers}
          height={460}
          label={`${strings.modelLabel} — ${current.title}`}
          strings={strings.viewer}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
          {strings.noGeometry}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary">
            {strings.stopOf
              .replace("{n}", String(index + 1))
              .replace("{total}", String(stops.length))}
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-1.5 text-xl font-light text-text-primary outline-none focus-visible:underline"
          >
            {current.title}
          </h2>
          {current.body ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
              {current.body}
            </p>
          ) : null}
          {current.href ? (
            <Link
              href={current.href}
              className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {strings.readMore}
              {current.contextLabel ? ` — ${current.contextLabel}` : ""}
            </Link>
          ) : null}
        </div>

        <nav aria-label={strings.allStops} className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-soft px-4 py-2 text-xs text-text-secondary transition hover:bg-surface-2 disabled:opacity-40"
          >
            <ArrowLeft size={13} strokeWidth={1.8} aria-hidden />
            {strings.previous}
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={atEnd}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {strings.next}
            <ArrowRight size={13} strokeWidth={1.8} aria-hidden />
          </button>
        </nav>
      </div>

      {atEnd ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-700">
          <Check size={13} strokeWidth={1.9} aria-hidden />
          {strings.endOfTour}
        </p>
      ) : null}

      {/* Every stop as text. §10.1 requires a non-3D equivalent, and it is
          also what works before the geometry arrives, on a locked-down kiosk,
          and for a visitor who would simply rather read. */}
      <section className="mt-12 border-t border-line-soft pt-8">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {strings.allStops}
        </h2>
        <ol className="divide-y divide-line-soft">
          {stops.map((s, i) => (
            <li key={s.id} className="py-4">
              <button
                type="button"
                onClick={() => go(i)}
                className="block w-full text-left"
              >
                <span className="flex items-baseline gap-3">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-text-tertiary">
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm ${
                      i === index ? "text-accent" : "text-text-primary"
                    }`}
                  >
                    {s.title}
                  </span>
                </span>
              </button>
              {s.body ? (
                <p className="mt-1.5 pl-8 text-sm leading-relaxed text-text-secondary">
                  {s.body}
                </p>
              ) : null}
              {s.href ? (
                <Link
                  href={s.href}
                  className="mt-1.5 ml-8 inline-block text-xs text-accent hover:underline"
                >
                  {strings.readMore}
                  {s.contextLabel ? ` — ${s.contextLabel}` : ""}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
