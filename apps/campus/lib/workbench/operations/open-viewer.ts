import type { Operation } from "@klorad/config/workbench";

/**
 * Open the world's public viewer in a new tab. World-level operation
 * (no entity scope). Applies always; the public viewer route exists
 * for every map.
 *
 * Public URL convention: `${origin}/campus/${worldId}` — same
 * pattern the SettingsTab uses for its "Public Link" copy.
 */
export const openViewerOp: Operation = {
  id: "world.open-viewer",
  label: "Open public viewer",
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    if (typeof window === "undefined") {
      return { ok: false, reason: "Not in a browser" };
    }
    const url = `${window.location.origin}/campus/${ctx.worldId}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      ctx.toast("Pop-up blocked — couldn't open the public viewer", "warning");
      return { ok: false, reason: "Pop-up blocked" };
    }
    ctx.toast("Opened public viewer in a new tab", "success");
    return { ok: true };
  },
};
