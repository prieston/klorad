import type { ReactNode } from "react";

/** Shared page chrome for the curator console: eyebrow, title, lede, actions. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div>
        {eyebrow ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          {title}
        </h1>
        {lede ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

/** Count pill for a section heading. */
export function CountPill({ n }: { n: number }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] tracking-normal ${
        n > 0 ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-tertiary"
      }`}
    >
      {n}
    </span>
  );
}
