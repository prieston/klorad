import type { Operation } from "@klorad/config/workbench";

/**
 * Copy the world's public-viewer URL to the clipboard. World-level
 * operation (no entity scope). Pairs with `world.open-viewer`.
 */
export const copyLinkOp: Operation = {
  id: "world.copy-link",
  label: "Copy public link",
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    if (typeof window === "undefined") {
      return { ok: false, reason: "Not in a browser" };
    }
    const url = `${window.location.origin}/campus/${ctx.worldId}`;
    try {
      await navigator.clipboard.writeText(url);
      ctx.toast("Public link copied to clipboard", "success");
      return { ok: true };
    } catch {
      ctx.toast("Couldn't copy the public link", "error");
      return { ok: false, reason: "Clipboard write failed" };
    }
  },
};
