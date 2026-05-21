import type { Operation } from "@klorad/config/workbench";

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * Copy the world's public-viewer URL to the clipboard. World-level
 * operation (no entity scope). Pairs with `world.open-viewer`.
 */
export const copyLinkOp: Operation = {
  id: "world.copy-link",
  label: "Copy public link",
  icon: CopyIcon,
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
