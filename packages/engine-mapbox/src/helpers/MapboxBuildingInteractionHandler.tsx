"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, InteractionEvent } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";

const BUILDING_CLICK_ID = "klorad-building-click";

/**
 * Mapbox Standard: click buildings (basemap featureset) and expose properties in the scene store.
 * @see https://docs.mapbox.com/mapbox-gl-js/guides/user-interactions/interactions
 */
export default function MapboxBuildingInteractionHandler({
  map,
}: {
  map: MapboxMap | null;
}) {
  const setSelectedMapboxBuilding = useSceneStore(
    (s) => s.setSelectedMapboxBuilding
  );
  const importId = useSceneStore(
    (s) => s.mapboxSceneData.standardBasemap?.importId ?? "basemap"
  );

  const importIdRef = useRef(importId);
  importIdRef.current = importId;

  useEffect(() => {
    if (!map) return;

    const attach = () => {
      try {
        map.removeInteraction(BUILDING_CLICK_ID);
      } catch {
        /* not registered */
      }
      try {
        map.addInteraction(BUILDING_CLICK_ID, {
          type: "click",
          target: {
            featuresetId: "buildings",
            importId: importIdRef.current,
          },
          handler: (e: InteractionEvent) => {
            if (useSceneStore.getState().selectingPosition) {
              return;
            }
            const f = e.feature;
            const raw = f?.properties;
            const props: Record<string, unknown> =
              raw &&
              typeof raw === "object" &&
              !Array.isArray(raw) &&
              raw !== null
                ? { ...(raw as Record<string, unknown>) }
                : {};
            setSelectedMapboxBuilding({
              properties: props,
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
            });
          },
        });
      } catch {
        /* Classic styles / no featureset */
      }
    };

    if (map.isStyleLoaded()) attach();
    map.on("style.load", attach);

    return () => {
      map.off("style.load", attach);
      try {
        map.removeInteraction(BUILDING_CLICK_ID);
      } catch {
        /* ignore */
      }
    };
  }, [map, importId, setSelectedMapboxBuilding]);

  return null;
}
