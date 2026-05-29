import { Sparkles } from "lucide-react";

interface Props {
  /** Big title — matches the rail item that points here. */
  title: string;
  /** One-line description of what this surface will eventually own. */
  hint: string;
  /** Phase label so the visitor can place it on the roadmap ("Phase 4"). */
  phase: string;
}

/**
 * Stub renderer for the IA's new screens — Home / Map / Klio / Reach /
 * Identity. The shell ships in Phase 1 of [[campus-backoffice-redesign]],
 * but the real screens land in later phases. Showing an honest "this
 * surface exists, it just isn't built yet" placeholder is better than
 * dead links that confuse the rector and break trust in the nav.
 */
export function ComingSoonScreen({ title, hint, phase }: Props) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line-soft bg-surface-1 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
          <Sparkles
            size={20}
            strokeWidth={1.6}
            className="text-accent"
            aria-hidden
          />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-text-primary">
          {title}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">{hint}</p>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          {phase}
        </p>
      </div>
    </div>
  );
}
