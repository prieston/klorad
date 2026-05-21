import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

function PublishIcon({ className }: { className?: string }) {
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
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
      <path d="M5 21h14" />
    </svg>
  );
}

/**
 * Flip the campus's `isPublished` flag from the workbench.
 *
 * Phase 0 of the production-polish arc. Same backend route the
 * dashboard hero hits (PATCH /api/maps/{id} with `isPublished: true`),
 * but now reachable from the workbench's `⌘K` command palette and
 * the OverviewView's WorldActions panel — wherever the author
 * happens to be.
 *
 * Currently a one-way toggle from the workbench; unpublish stays on
 * the dashboard (you don't usually take a live campus down from
 * inside the editor). Could extend with `world.unpublish` later if
 * the workflow demands it.
 */
export const publishWorldOp: Operation = {
  id: "world.publish",
  label: "Publish campus",
  icon: PublishIcon,
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    try {
      const res = await fetch(`/api/maps/${ctx.worldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });
      if (!res.ok) {
        ctx.toast("Failed to publish", "error");
        return { ok: false, reason: `Publish failed: ${res.status}` };
      }
      // Bump the campus API store so any view that mirrors world
      // metadata re-pulls.
      useCampusApiStore.getState().bump();
      ctx.toast("Campus published", "success");
      return { ok: true };
    } catch (err) {
      ctx.toast("Failed to publish", "error");
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Publish failed",
      };
    }
  },
};
