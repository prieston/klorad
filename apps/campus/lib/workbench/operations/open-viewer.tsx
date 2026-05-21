import type { Operation } from "@klorad/config/workbench";

function OpenViewerIcon({ className }: { className?: string }) {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

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
  icon: OpenViewerIcon,
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
