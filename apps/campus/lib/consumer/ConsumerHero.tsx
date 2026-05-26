import Link from "next/link";
import { Sparkles } from "lucide-react";
import { MapTeaser } from "./MapTeaser";

export interface ConsumerHeroProps {
  /** Primary headline — falls back to a generic line if the org hasn't set one. */
  headline: string;
  subheading: string;
  /** Honest copy: where the "Get started" CTA lands. */
  primaryHref: string;
  primaryLabel: string;
  /** Optional secondary CTA — "Watch the tour" in the brief. */
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Map link the right-column teaser opens. */
  mapHref: string;
  /** Real venue thumbnail — preferred over a fallback illustration. */
  mapThumbnailUrl?: string;
}

/** Four pastel avatar circles, decorative — the "joined by 8,400" social proof. */
function AvatarStack() {
  const colors = ["#534AB7", "#D85A30", "#1D9E75", "#D4537E"];
  return (
    <div className="flex -space-x-2">
      {colors.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block h-7 w-7 rounded-full border-2 border-[var(--brand-primary-bg)]"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

/**
 * Two-column hero. Left column lives on the soft-purple background
 * (`--brand-primary-bg`) with two decorative blobs — a large purple
 * circle bottom-right, a coral circle top-right — copy stacked over
 * the top, two CTAs, social-proof avatar stack at the bottom. Right
 * column is the `MapTeaser`. On mobile the columns stack vertically.
 */
export function ConsumerHero({
  headline,
  subheading,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  mapHref,
  mapThumbnailUrl,
}: ConsumerHeroProps) {
  return (
    <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:px-6 md:py-12">
      <div className="relative overflow-hidden rounded-2xl bg-[var(--brand-primary-bg)] p-8 md:p-12">
        {/* Decorative blobs */}
        <span
          aria-hidden
          className="absolute -bottom-12 -right-12 h-56 w-56 rounded-full"
          style={{ backgroundColor: "var(--brand-primary)", opacity: 0.18 }}
        />
        <span
          aria-hidden
          className="absolute -right-4 top-6 h-16 w-16 rounded-full"
          style={{ backgroundColor: "#D85A30", opacity: 0.55 }}
        />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--brand-text)]">
            <Sparkles size={14} className="text-[var(--brand-primary)]" />
            Made for students, by students
          </span>

          <h1 className="mt-6 max-w-xl text-3xl font-medium leading-tight tracking-tight text-[var(--brand-text)] md:text-4xl">
            {headline}
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--brand-text-muted)]">
            {subheading}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center rounded-full border border-[var(--brand-line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <AvatarStack />
            <span className="text-xs text-[var(--brand-text-muted)]">
              Joined by 8,400+ students this semester.
            </span>
          </div>
        </div>
      </div>

      <MapTeaser mapHref={mapHref} thumbnailUrl={mapThumbnailUrl} />
    </section>
  );
}
