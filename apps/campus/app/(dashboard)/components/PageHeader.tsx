import type { ReactNode } from "react";

interface Props {
  /** Small caps eyebrow above the title — e.g. "Organisation". */
  eyebrow?: string;
  /** The big title. */
  title: string;
  /** Optional one-line description below the title. */
  subtitle?: string;
  /** Right-side actions slot (typically buttons). */
  actions?: ReactNode;
}

/**
 * Shared header used at the top of every backoffice screen. Sits flush
 * against the AppShell content area's top edge and gives every screen
 * the same vertical rhythm + the same place for primary actions.
 *
 * Designed to be replaceable by per-screen variants when a screen
 * needs richer chrome (e.g. status pills, breadcrumbs) — this is the
 * default for the common case.
 */
export function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 truncate text-2xl font-semibold text-text-primary">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
