"use client";

import { useEffect, useRef, useState } from "react";
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
}: {
  layers: ViewerLayer[];
  proxies?: ProxyHotspot[];
  showProxies?: boolean;
  onSelectProxy?: (id: string) => void;
  className?: string;
  height?: number;
}) {
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
        onReady: () => setState("ready"),
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

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface-2 ${className ?? ""}`}
      style={{ height }}
    >
      <div ref={hostRef} className="h-full w-full" />

      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-text-tertiary">
          <Loader2 size={20} strokeWidth={1.8} aria-hidden className="animate-spin text-accent" />
          <p className="text-xs">Loading the model…</p>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle size={20} strokeWidth={1.8} aria-hidden className="text-amber-600" />
          <p className="max-w-sm text-xs leading-relaxed text-text-secondary">
            {message ?? "This model could not be loaded."}
          </p>
        </div>
      )}

      {state === "ready" && proxies.length > 0 && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface-1/90 px-3 py-1 text-[11px] text-text-tertiary">
          Drag to orbit · arrow keys to step through {proxies.length} point
          {proxies.length === 1 ? "" : "s"} of interest
        </p>
      )}
    </div>
  );
}
