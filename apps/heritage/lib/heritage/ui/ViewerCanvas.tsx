"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type {
  HeritageViewer,
  ProxyHotspot,
  ViewerLayer,
} from "@klorad/engine-three/viewer";

/**
 * React wrapper around the vanilla viewer.
 *
 * The viewer itself is imported dynamically so `three` never lands in the
 * initial bundle of a page that may not need it — §9.3 budgets 3 seconds to
 * first meaningful render on a mid-range phone on 4G, and the page chrome and
 * the record text should be readable long before the geometry arrives.
 *
 * Everything reachable here is also reachable without it: the caller renders a
 * textual equivalent alongside, which §7.1.1 and §10.1 make mandatory rather
 * than optional. A blind visitor gets nothing from photorealism, and the
 * honest answer is a record they can read.
 */
export function ViewerCanvas({
  layers,
  proxies = [],
  showProxies = false,
  onSelectProxy,
  className,
  height = 460,
  label,
  strings,
  onViewerReady,
  editable = false,
  mode,
  onSelectLayer,
  onTransformLayer,
  onPlaceProxy,
  onTransformProxy,
}: {
  layers: ViewerLayer[];
  proxies?: ProxyHotspot[];
  showProxies?: boolean;
  onSelectProxy?: (id: string) => void;
  className?: string;
  height?: number;
  /** What this canvas shows, for anyone who cannot see it. Falls back to a
   *  generic description rather than to nothing. */
  label?: string;
  /** Localised status text. Plain strings only — a server component cannot
   *  hand a function to a client one, and that failure is a runtime 500 the
   *  type checker does not catch. Optional so the console can keep using
   *  English without threading a language through every authoring screen. */
  strings?: { loading: string; failed: string; hint: string };
  /** Handed the live viewer once it exists, for callers that need to drive the
   *  camera — a guided tour flying to each stop's authored viewpoint. A
   *  callback rather than a forwarded ref because the viewer is created
   *  asynchronously inside an effect, so there is no instance to forward at
   *  the moment React would wire a ref up. */
  onViewerReady?: (viewer: HeritageViewer) => void;
  /** Turns on the transform gizmo and canvas selection. */
  editable?: boolean;
  /** What a click means when editable — placing hotspots, or selecting whole
   *  models to arrange a scene. */
  mode?: "proxies" | "layers";
  onSelectLayer?: (id: string | null) => void;
  onTransformLayer?: (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number, number];
      scale: [number, number, number];
    },
  ) => void;
  onPlaceProxy?: (transform: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  }) => void;
  onTransformProxy?: (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number, number];
      scale: [number, number, number];
    },
  ) => void;
}) {
  const copy = strings ?? {
    loading: "Loading the model…",
    failed: "This model could not be loaded.",
    hint: `Drag to orbit · arrow keys to step through ${proxies.length} point${
      proxies.length === 1 ? "" : "s"
    } of interest`,
  };
  const instructionsId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HeritageViewer | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    void (async () => {
      const mod = await import("@klorad/engine-three/viewer");
      if (cancelled || !hostRef.current) return;
      viewerRef.current = new mod.HeritageViewer({
        container: hostRef.current,
        layers,
        proxies,
        showProxies,
        onSelectProxy,
        editable,
        mode,
        onSelectLayer,
        onTransformLayer,
        onPlaceProxy,
        onTransformProxy,
        onReady: () => {
          setState("ready");
          if (viewerRef.current) onViewerReady?.(viewerRef.current);
        },
        onError: (m) => {
          setState("error");
          setMessage(m);
        },
      });
    })();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // Layers and proxies are identity-stable per render from the server
    // component that owns them; re-running on every render would tear down
    // and rebuild the WebGL context on each paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interactive = proxies.length > 0;

  return (
    <div
      // Focusable so the arrow-key stepping is reachable at all: the viewer
      // listens for keys, but a keyboard user could never give it focus.
      // `application` only where those keys actually do something — claiming
      // it for a static model would suppress a screen reader's browse mode in
      // exchange for nothing.
      tabIndex={0}
      role={interactive ? "application" : "img"}
      aria-label={
        label ??
        (interactive
          ? `Interactive 3D model with ${proxies.length} points of interest`
          : "3D model")
      }
      aria-describedby={interactive ? instructionsId : undefined}
      className={`relative overflow-hidden rounded-2xl bg-surface-2 outline-none ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""}`}
      // height={0} means "fill the parent" — the embed shell sizes itself to
      // the iframe and the canvas has to follow, rather than the caller
      // guessing a pixel height it cannot know.
      style={height > 0 ? { height } : { height: "100%" }}
    >
      <div ref={hostRef} className="h-full w-full" />

      {/* Announced rather than only drawn: a screen-reader user otherwise has
          no way to tell a model that is still downloading from one that
          silently failed. */}
      <div className="sr-only" role="status" aria-live="polite">
        {state === "loading" ? copy.loading : state === "error" ? message ?? copy.failed : ""}
      </div>

      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-text-tertiary">
          <Loader2 size={20} strokeWidth={1.8} aria-hidden className="animate-spin text-accent" />
          <p className="text-xs">{copy.loading}</p>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle size={20} strokeWidth={1.8} aria-hidden className="text-amber-600" />
          <p className="max-w-sm text-xs leading-relaxed text-text-secondary">
            {message ?? copy.failed}
          </p>
        </div>
      )}

      {state === "ready" && proxies.length > 0 && (
        <p
          id={instructionsId}
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface-1/90 px-3 py-1 text-[11px] text-text-tertiary"
        >
          {copy.hint}
        </p>
      )}
    </div>
  );
}
