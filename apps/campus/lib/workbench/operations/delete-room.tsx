import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6 17.5 19a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export const deleteRoomOp: Operation = {
  id: "room.delete",
  label: "Delete room",
  icon: TrashIcon,
  scope: ["campus.room"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    return entities.byId(sel.focusedId)?.typeId === "campus.room";
  },
  async invoke(ctx, _args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No room id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const entity = ctx.entities.byId(id);
    const name =
      (entity?.payload as { name?: string } | undefined)?.name || "Room";

    api.rooms.remove(id);
    useCampusApiStore.getState().bump();

    ctx.toast(`Deleted ${name}`, "success");
    return { ok: true };
  },
};
