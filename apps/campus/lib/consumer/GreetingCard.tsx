"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type Greeting = {
  morning: string;
  afternoon: string;
  evening: string;
  night: string;
  placeholder: string;
};

const COPY: Record<"en" | "el", Greeting> = {
  en: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    night: "Hi there",
    placeholder: "Search buildings, events, food…",
  },
  el: {
    morning: "Καλημέρα",
    afternoon: "Καλό απόγευμα",
    evening: "Καλό βράδυ",
    night: "Γεια σας",
    placeholder: "Κτίρια, εκδηλώσεις, φαγητό…",
  },
};

function pickGreeting(hour: number, copy: Greeting): string {
  if (hour >= 5 && hour < 12) return copy.morning;
  if (hour >= 12 && hour < 17) return copy.afternoon;
  if (hour >= 17 && hour < 22) return copy.evening;
  return copy.night;
}

interface Props {
  /** Where the search bar lands when tapped — should be the Klio tab. */
  klioHref: string;
  /** EN/EL strings table. */
  locale: "en" | "el";
  /** Optional hero image painted behind the brand-colour overlay. */
  backgroundImageUrl?: string;
  /** Rector-defined headline. When set, replaces the platform's
   *  "Welcome 👋" copy as the H1. */
  headline?: string;
  /** Rector-defined tagline. When set, replaces the platform's
   *  time-of-day greeting as the eyebrow line above the headline. */
  tagline?: string;
  /** Rector-defined CTA copy for the Klio search chip. Falls back
   *  to the locale-specific search placeholder. */
  ctaLabel?: string;
}

/**
 * The mobile-first home's top card — friendly time-of-day greeting +
 * a search-style chip that routes into Klio. Client component so the
 * greeting reflects the visitor's local clock (SSR'd greetings would
 * be wrong for anyone in a different timezone than the server).
 *
 * When `backgroundImageUrl` is set, the campus hero (from
 * `sceneData.homePage.heroImage` or the MappedIn thumbnail) is
 * painted full-bleed behind a partially-transparent brand overlay,
 * so the photo shines through the colour without losing the
 * playful shapes or the white type.
 */
export function GreetingCard({
  klioHref,
  locale,
  backgroundImageUrl,
  headline,
  tagline,
  ctaLabel,
}: Props) {
  const copy = COPY[locale];
  const [greeting, setGreeting] = useState<string>(copy.afternoon);

  useEffect(() => {
    setGreeting(pickGreeting(new Date().getHours(), copy));
  }, [copy]);

  // Rector overrides win; the time-of-day greeting + the platform
  // "Welcome" stay as the friendly default.
  const eyebrow = tagline?.trim() || greeting;
  const heading =
    headline?.trim() ||
    (locale === "el" ? "Καλώς ήρθες 👋" : "Welcome 👋");
  const searchCopy = ctaLabel?.trim() || copy.placeholder;

  return (
    <section className="mx-auto max-w-[1280px] px-4 pt-4 md:px-6 md:pt-6">
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white md:p-8"
        style={
          backgroundImageUrl
            ? {
                backgroundImage: `url(${backgroundImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { backgroundColor: "var(--brand-primary-fill)" }
        }
      >
        {/* Brand-colour overlay — only when an image is present. Sits
            above the photo, below the decorative shapes and copy.
            ~75% opacity preserves legibility while letting the
            building / venue photo come through. */}
        {backgroundImageUrl ? (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundColor: "var(--brand-primary-fill)",
              opacity: 0.78,
            }}
          />
        ) : null}
        <span
          aria-hidden
          className="absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-white/15"
        />
        <p className="relative text-sm font-medium text-white/85">
          {eyebrow}
        </p>
        <h1 className="relative mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {heading}
        </h1>

        <Link
          href={klioHref}
          className="relative mt-5 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm text-[var(--brand-text-muted)] shadow-sm transition-colors hover:text-[var(--brand-text)]"
        >
          <Search size={16} strokeWidth={2} className="shrink-0" />
          <span className="truncate">{searchCopy}</span>
        </Link>
      </div>
    </section>
  );
}
