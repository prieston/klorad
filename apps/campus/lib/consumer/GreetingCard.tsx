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
}

/**
 * The mobile-first home's top card — friendly time-of-day greeting +
 * a search-style chip that routes into Klio. Client component so the
 * greeting reflects the visitor's local clock (SSR'd greetings would
 * be wrong for anyone in a different timezone than the server).
 */
export function GreetingCard({ klioHref, locale }: Props) {
  const copy = COPY[locale];
  const [greeting, setGreeting] = useState<string>(copy.afternoon);

  useEffect(() => {
    setGreeting(pickGreeting(new Date().getHours(), copy));
  }, [copy]);

  return (
    <section className="mx-auto max-w-[1280px] px-4 pt-4 md:px-6 md:pt-6">
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white md:p-8"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <span
          aria-hidden
          className="absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-white/15"
        />
        <p className="relative text-sm font-medium text-white/85">
          {greeting}
        </p>
        <h1 className="relative mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {locale === "el" ? "Καλώς ήρθες 👋" : "Welcome 👋"}
        </h1>

        <Link
          href={klioHref}
          className="relative mt-5 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm text-[var(--brand-text-muted)] shadow-sm transition-colors hover:text-[var(--brand-text)]"
        >
          <Search size={16} strokeWidth={2} className="shrink-0" />
          <span className="truncate">{copy.placeholder}</span>
        </Link>
      </div>
    </section>
  );
}
