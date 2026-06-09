import Link from "next/link";
import { Wrench } from "lucide-react";

/**
 * Shared placeholder for routes that exist in the IA but haven't shipped
 * a real implementation yet. Each placeholder names the upcoming feature
 * + the PR phase it belongs to so it's clear the nav isn't broken — the
 * pages just aren't built yet.
 */
export function ComingSoon({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto flex min-h-[80dvh] w-full max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16 md:px-10">
      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <Wrench size={12} strokeWidth={1.8} aria-hidden />
        {eyebrow}
      </span>
      <h1 className="text-3xl font-light leading-[1.1] text-text-primary md:text-4xl">
        {title}
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-text-secondary">
        {description}
      </p>
      <Link
        href={backHref}
        className="inline-flex items-center justify-center rounded-md border border-line-strong px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
      >
        {backLabel}
      </Link>
    </main>
  );
}
