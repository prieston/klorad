"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { mutate } from "swr";
import { Button } from "@klorad/design-system";
import { uploadFile } from "@klorad/storage/client";
import {
  MappedinViewer,
  type MappedinViewerHandle,
} from "@/lib/mappedin/MappedinViewer";
import { venueForIndoorMap } from "@/lib/mappedin/config";

interface Props {
  map: { sceneData?: unknown };
  /** Jump to the Settings tab to configure the indoor map. */
  onConfigure?: () => void;
}

/**
 * The campus profile's "Indoor" tab — the MappedIn viewer rendered
 * inside Klorad's dashboard chrome.
 *
 * Reads the campus's `indoorMapId` (set on the Settings tab). If
 * none is configured, shows an empty state pointing at Settings.
 * Also hosts the **"Capture thumbnail"** action: snapshots the
 * current view (`mapView.takeScreenshot()`), uploads it, and saves
 * the URL as the campus's thumbnail — the image shown on the campus
 * card and as the home page's hero fallback.
 *
 * The `data-mappedin` marker restores border / list styling for the
 * viewer's controls (Tailwind preflight is off app-wide).
 */
export default function IndoorTab({ map, onConfigure }: Props) {
  const params = useParams<{ mapId: string }>();
  const mapId = params?.mapId ?? "";

  const scene = map.sceneData as
    | { indoorMapId?: string; branding?: { primaryColor?: string } }
    | undefined;
  const indoorMapId = scene?.indoorMapId;
  const accentColor =
    scene?.branding?.primaryColor &&
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(scene.branding.primaryColor)
      ? scene.branding.primaryColor
      : undefined;

  const viewerRef = useRef<MappedinViewerHandle>(null);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    if (!mapId) return;
    setCapturing(true);
    try {
      const dataUrl = await viewerRef.current?.capture();
      if (!dataUrl) {
        toast.error("Couldn't capture — wait for the venue to load");
        return;
      }
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${mapId}-thumbnail.png`, {
        type: blob.type || "image/png",
      });
      const { publicUrl } = await uploadFile(file, {
        prefix: "campus-thumbnails",
      });
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: publicUrl }),
      });
      if (!res.ok) throw new Error("save");
      await mutate(`/api/maps/${mapId}`);
      toast.success("Campus thumbnail updated");
    } catch (e) {
      // Surface what actually failed (upload error, 4xx from the
      // PATCH, network drop) — the generic toast made all of these
      // look identical and left nothing in the console for support.
      console.error("Thumbnail capture failed:", e);
      toast.error(
        e instanceof Error
          ? `Couldn't save the thumbnail: ${e.message}`
          : "Couldn't save the thumbnail",
      );
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div data-mappedin className="space-y-3 pt-6">
      {indoorMapId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-tertiary">
              Frame the view, then capture it as the campus card image.
            </p>
            <Button
              size="sm"
              onClick={handleCapture}
              disabled={capturing}
            >
              {capturing ? "Capturing…" : "Capture thumbnail"}
            </Button>
          </div>
          <div className="h-[72vh] overflow-hidden rounded-2xl border border-line-soft">
            <MappedinViewer
              ref={viewerRef}
              venue={venueForIndoorMap(indoorMapId)}
              accentColor={accentColor}
            />
          </div>
        </>
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
