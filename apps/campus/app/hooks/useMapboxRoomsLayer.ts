"use client";

import { useMemo } from "react";
import {
  useMapboxIndoorExtrusion,
  type IndoorExtrusionFeature,
} from "@klorad/engine-mapbox";
import type { Room } from "@klorad/api";
import { roomColor, roomHeightM } from "@/app/lib/roomTemplates";
import { FLOOR_HEIGHT_M } from "./useMapboxFloorSlabsLayer";

/**
 * Campus-side adapter over the generic `useMapboxIndoorExtrusion`
 * hook in `@klorad/engine-mapbox`.
 *
 * Translates campus `Room` records into the engine's
 * `IndoorExtrusionFeature` shape — computes per-room base/height
 * elevations from the building's floor-height constant and the
 * room's template-driven height; resolves the fill color from
 * `roomColor`; stamps the room type onto `extra` so any expression
 * downstream can read it.
 *
 * Every other vertical that maps interior space (Heritage's
 * stratigraphy layers, Mobility's transit-floor view) ships its own
 * thin adapter in this shape — the engine package owns the rendering,
 * the consumer owns the domain.
 */
export function useMapboxRoomsLayer(
  rooms: Room[],
  opts: {
    activeFloor?: number | null;
    onSelect?: (roomId: string) => void;
    highlightRoomId?: string | null;
    /** When false, click + hover ignored (e.g. during polygon draw). */
    clickEnabled?: boolean;
  } = {},
) {
  const features = useMemo<IndoorExtrusionFeature[]>(() => {
    return rooms
      .filter((r) => r.visible !== false)
      .filter((r) => r.polygon.length >= 3)
      .map((r) => {
        const h = roomHeightM(r);
        // Stack rooms on consistent floor slabs so a tall amphitheatre
        // on floor 1 still sits at FLOOR_HEIGHT_M m, not at 1×6 m.
        // 0.65 sits just above the slab's top face (0.6 thick).
        const base = r.floor * FLOOR_HEIGHT_M + 0.65;
        return {
          id: r.id,
          polygon: r.polygon,
          level: r.floor,
          base,
          height: base + h,
          color: roomColor(r),
          name: r.name,
          extra: { type: r.type, floor: r.floor },
        } satisfies IndoorExtrusionFeature;
      });
  }, [rooms]);

  useMapboxIndoorExtrusion({
    namespace: "campus-rooms",
    features,
    activeLevel: opts.activeFloor ?? null,
    highlightId: opts.highlightRoomId ?? null,
    onSelect: opts.onSelect,
    clickEnabled: opts.clickEnabled,
  });
}
