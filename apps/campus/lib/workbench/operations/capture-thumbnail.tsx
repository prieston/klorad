import type { Operation } from "@klorad/config/workbench";
import { useSceneStore } from "@klorad/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { captureMapboxScreenshot } from "@/app/utils/captureMapboxScreenshot";

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/**
 * Capture the current Mapbox view as the map's card thumbnail and
 * persist it to the backend.
 *
 * Phase 5d-c. Wraps `BuilderClient`'s two-step thumbnail flow
 * (capture → preview → save) into a single op for now — captures
 * the canvas and PATCHes `/api/maps/{worldId}.thumbnail`. The
 * preview-before-save UX gets its own op with a Form modal in a
 * follow-up if useful.
 *
 * World-level. Reaches the Mapbox instance via the same
 * `useSceneStore` singleton `poi.fly-to` uses.
 */
export const captureThumbnailOp: Operation = {
  id: "world.capture-thumbnail",
  label: "Capture thumbnail",
  icon: CameraIcon,
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) {
      ctx.toast("Map not ready", "error");
      return { ok: false, reason: "Map not loaded" };
    }
    try {
      const dataUrl = await captureMapboxScreenshot(map);
      if (!dataUrl) {
        ctx.toast("No image captured", "error");
        return { ok: false, reason: "Empty capture" };
      }
      const res = await fetch(`/api/maps/${ctx.worldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: dataUrl }),
      });
      if (!res.ok) {
        ctx.toast("Failed to save thumbnail", "error");
        return { ok: false, reason: `Thumbnail save failed: ${res.status}` };
      }
      ctx.toast("Thumbnail saved", "success");
      return { ok: true };
    } catch (err) {
      ctx.toast(
        err instanceof Error ? err.message : "Failed to capture screenshot",
        "error",
      );
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Capture failed",
      };
    }
  },
};
