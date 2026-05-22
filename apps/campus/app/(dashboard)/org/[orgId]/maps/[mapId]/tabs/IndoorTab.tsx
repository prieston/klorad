"use client";

import { Button } from "@klorad/design-system";
import { MappedinViewer } from "@/lib/mappedin/MappedinViewer";
import { venueForIndoorMap } from "@/lib/mappedin/config";

interface Props {
  map: { sceneData?: unknown };
  /** Jump to the Settings tab to configure the indoor map. */
  onConfigure?: () => void;
}

/**
 * The campus profile's "Indoor" tab — the indoor 3D viewer rendered
 * inside Klorad's dashboard chrome.
 *
 * Reads the campus's `indoorMapId` (set on the Settings tab). If none
 * is configured, shows an empty state pointing at Settings. The
 * `data-mappedin` marker on the wrapper restores border / list
 * styling for the viewer's controls (Tailwind preflight is off
 * app-wide — see global.css).
 */
export default function IndoorTab({ map, onConfigure }: Props) {
  const indoorMapId = (
    map.sceneData as { indoorMapId?: string } | undefined
  )?.indoorMapId;

  return (
    <div data-mappedin className="pt-6">
      {indoorMapId ? (
        <div className="h-[72vh] overflow-hidden rounded-2xl border border-line-soft">
          <MappedinViewer venue={venueForIndoorMap(indoorMapId)} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-soft py-20 text-center">
          <p className="text-sm font-medium text-text-primary">
            No indoor map yet
          </p>
          <p className="max-w-sm text-xs text-text-tertiary">
            Add an indoor map ID in Settings to enable the 3D indoor viewer
            and wayfinding for this campus.
          </p>
          {onConfigure ? (
            <Button size="sm" variant="secondary" onClick={onConfigure}>
              Go to Settings
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
