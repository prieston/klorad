"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl, {
  type Map as MapboxMap,
  type Marker,
  type Popup,
} from "mapbox-gl";
import { ArrowRight, MapPinOff, Maximize2 } from "lucide-react";
import type { CampusMap } from "@/app/hooks/useMaps";

interface Props {
  maps: CampusMap[];
  /** Org id — needed so the empty-state CTA can deep-link the rector
   *  into the unlocated campus's Identity screen. */
  orgId: string;
  /** Tailwind height — overridable so the same component fits a hero
   *  banner (taller) or a sidebar widget. */
  className?: string;
}

const FALLBACK_CENTER: [number, number] = [23.7275, 37.9838]; // Athens
const FALLBACK_ZOOM = 4;
// Brand accent — mirrors `--accent` in the tokens.css palette.
const PIN_COLOR = "#158ca3";

/**
 * The Org Overview's world map — one pin per campus that has a stored
 * `center` coordinate. The only surviving Mapbox surface in the
 * product per [[campus-indoor-mappedin-decision]]; everything inside
 * a single campus uses MappedIn.
 *
 * Lives in the dashboard chrome only — public surfaces never embed
 * this. The map is non-interactive enough for an overview (cooperative
 * gestures, no scroll-zoom hijack) and zooms to fit on prop change so
 * adding a campus immediately reframes.
 *
 * Renders a "set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" hint instead of
 * silently failing when the token isn't configured — the dashboard
 * is rector-facing, so being explicit about the gap beats a blank
 * box.
 */
export function OrgWorldMap({ maps, orgId, className = "h-[260px]" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const hoverPopupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);

  const pins = useMemo(
    () =>
      maps
        .filter(
          (
            m,
          ): m is CampusMap & { center: [number, number] } =>
            Array.isArray(m.center) &&
            typeof m.center[0] === "number" &&
            typeof m.center[1] === "number",
        )
        .map((m) => ({
          id: m.id,
          name: m.name,
          center: m.center,
          thumbnail: m.thumbnail ?? null,
        })),
    [maps],
  );

  // Campuses without a usable coordinate — used to power the empty-
  // state CTA. We list at most three by name; if more, the rest are
  // counted but not enumerated to keep the strip short.
  const unlocated = useMemo(
    () =>
      maps.filter(
        (m) =>
          !Array.isArray(m.center) ||
          typeof m.center[0] !== "number" ||
          typeof m.center[1] !== "number",
      ),
    [maps],
  );

  const fitToExtent = () => {
    const map = mapRef.current;
    if (!map) return;
    if (pins.length === 0) {
      map.flyTo({
        center: FALLBACK_CENTER,
        zoom: FALLBACK_ZOOM,
        duration: 800,
      });
      return;
    }
    if (pins.length === 1) {
      map.flyTo({ center: pins[0].center, zoom: 14, duration: 800 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(pins[0].center, pins[0].center);
    for (const p of pins) bounds.extend(p.center);
    map.fitBounds(bounds, { padding: 48, duration: 800, maxZoom: 15 });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      attributionControl: false,
      interactive: true,
      cooperativeGestures: true,
    });
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    hoverPopupRef.current?.remove();
    hoverPopupRef.current = null;

    const map = mapRef.current;

    for (const pin of pins) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.background = PIN_COLOR;
      el.style.border = "2px solid #fff";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
      el.style.cursor = "pointer";
      // Native title is the accessibility fallback when the hover
      // popup hasn't appeared yet (or never appears on touch).
      el.title = pin.name;
      const marker = new mapboxgl.Marker(el)
        .setLngLat(pin.center)
        .addTo(map);

      // One popup instance per hover — recycle to avoid stacking when
      // the rector slides between pins quickly. Click on the rendered
      // card opens the campus dashboard; the card itself is the
      // affordance, the pin underneath isn't (pin would be a 14px
      // hit target).
      el.addEventListener("mouseenter", () => {
        hoverPopupRef.current?.remove();
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          className: "klorad-pin-popup",
          maxWidth: "220px",
        })
          .setLngLat(pin.center)
          .setHTML(renderPinCard(pin, orgId))
          .addTo(map);
        hoverPopupRef.current = popup;
      });
      el.addEventListener("mouseleave", () => {
        // Defer so the popup gets a tick to register its own
        // mouseenter — if the cursor lands on the card the popup
        // shouldn't close.
        window.setTimeout(() => {
          const popupEl = hoverPopupRef.current?.getElement();
          if (popupEl && popupEl.matches(":hover")) return;
          hoverPopupRef.current?.remove();
          hoverPopupRef.current = null;
        }, 80);
      });

      markersRef.current.push(marker);
    }

    fitToExtent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready, orgId]);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-line-soft bg-surface-1 ${className}`}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!hasToken && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-text-secondary">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to see campus locations.
        </div>
      )}
      <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-1/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm backdrop-blur">
        <span>Campus locations</span>
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
          {pins.length}
        </span>
      </div>
      <button
        type="button"
        onClick={fitToExtent}
        disabled={pins.length === 0}
        aria-label="Fit to extent"
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-1/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm backdrop-blur transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Maximize2 size={12} strokeWidth={1.75} aria-hidden />
        Fit
      </button>

      {unlocated.length > 0 && hasToken ? (
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-full border border-line-soft bg-surface-1/95 px-3 py-1.5 text-xs text-text-primary shadow-sm backdrop-blur">
          <div className="inline-flex min-w-0 items-center gap-1.5 text-text-secondary">
            <MapPinOff
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className="shrink-0"
            />
            <span className="truncate">
              {summariseUnlocated(unlocated)}
            </span>
          </div>
          {unlocated.length === 1 ? (
            <Link
              href={`/org/${orgId}/maps/${unlocated[0].id}/identity`}
              className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline"
            >
              Set location
              <ArrowRight size={11} strokeWidth={1.75} aria-hidden />
            </Link>
          ) : (
            <Link
              href={`/org/${orgId}/maps`}
              className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline"
            >
              Set locations
              <ArrowRight size={11} strokeWidth={1.75} aria-hidden />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface Pin {
  id: string;
  name: string;
  thumbnail: string | null;
}

/**
 * Inline HTML for a pin's hover popup. Mapbox's popup API takes an
 * HTML string, not React, so we render a hand-rolled card with the
 * campus name + card image and a click target that opens its
 * dashboard. `escapeHtml` is conservative — campus names can contain
 * apostrophes and the like and we're injecting into innerHTML.
 */
function renderPinCard(pin: Pin, orgId: string): string {
  const name = escapeHtml(pin.name);
  const href = `/org/${orgId}/maps/${pin.id}`;
  const image = pin.thumbnail
    ? `<img src="${escapeHtml(pin.thumbnail)}" alt="" class="klorad-pin-thumb" />`
    : `<div class="klorad-pin-thumb klorad-pin-thumb--empty"></div>`;
  return `<a href="${href}" class="klorad-pin-card">${image}<span class="klorad-pin-name">${name}</span></a>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}

/** Friendly one-line summary of campuses without a location. Capped
 *  at two names so the strip stays inside a single line. */
function summariseUnlocated(rows: CampusMap[]): string {
  if (rows.length === 1) {
    return `${rows[0].name} has no location yet`;
  }
  if (rows.length === 2) {
    return `${rows[0].name} and ${rows[1].name} have no location yet`;
  }
  return `${rows.length} campuses without a location`;
}
