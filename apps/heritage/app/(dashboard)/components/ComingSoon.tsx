import Link from "next/link";
import { Wrench } from "lucide-react";

/**
 * Placeholder for curator-console routes that exist in the information
 * architecture but have not shipped an implementation yet.
 *
 * Each one names its requirement ID and phase from DOC-BU6-002_PRD-HER_EN so
 * the nav reads as a roadmap rather than as broken links, and so nobody has to
 * open the spec to find out whether a gap is deliberate. Framework 3.5 forbids
 * presenting unreleased features as confirmed — hence the explicit phase
 * label on every one of these.
 */
export function ComingSoon({
  requirement,
  phase,
  title,
  description,
  backHref,
  backLabel,
}: {
  /** e.g. "HER-203" */
  requirement: string;
  /** e.g. "Phase 1" */
  phase: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto flex min-h-[80dvh] w-full max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16 md:px-10">
      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <Wrench size={12} strokeWidth={1.8} aria-hidden />
        Not built yet
      </span>
      <h1 className="text-3xl font-light leading-[1.1] text-text-primary md:text-4xl">
        {title}
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-text-secondary">
        {description}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          {requirement}
        </span>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text-tertiary">
          {phase}
        </span>
      </div>
      <Link
        href={backHref}
        className="inline-flex items-center justify-center rounded-md border border-line-strong px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
      >
        {backLabel}
      </Link>
    </main>
  );
}
