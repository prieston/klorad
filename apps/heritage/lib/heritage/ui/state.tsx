/**
 * Publication state, shared across every content type.
 *
 * Draft → review → approve → publish is inherited from the Campus publishing
 * workflow (§7.2.8) and applies uniformly, so the vocabulary and the badge
 * live in one place rather than being re-spelled per page.
 */
export const PUBLISH_STATES = [
  ["draft", "Draft"],
  ["in_review", "In review"],
  ["approved", "Approved"],
  ["published", "Published"],
  ["archived", "Archived"],
] as const;

export type PublishState = (typeof PUBLISH_STATES)[number][0];

const TONE: Record<PublishState, string> = {
  draft: "bg-surface-2 text-text-tertiary",
  in_review: "bg-amber-500/10 text-amber-700",
  approved: "bg-sky-500/10 text-sky-700",
  published: "bg-emerald-500/10 text-emerald-600",
  archived: "bg-surface-2 text-text-tertiary line-through",
};

export function StateBadge({ state }: { state: PublishState }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${TONE[state]}`}
    >
      {PUBLISH_STATES.find(([v]) => v === state)?.[1] ?? state}
    </span>
  );
}
