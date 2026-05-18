import type { ReactNode } from "react";

/* Shared marketing-site primitives — used across the homepage and inner pages. */

export const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover";

export const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-line-strong px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}

export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function SectionHead({
  eyebrow,
  title,
  intro,
  center = false,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-3xl font-light leading-[1.12] text-text-primary md:text-[42px]">
        {title}
      </h2>
      {intro && (
        <p className="mt-5 text-base leading-relaxed text-text-secondary md:text-lg">
          {intro}
        </p>
      )}
    </div>
  );
}
