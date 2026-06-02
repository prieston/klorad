"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KLogo } from "./KLogo";
import { detectLocale, LOCALES, type Locale } from "@/app/lib/i18n-core";

interface NavLink {
  label: string;
  href: string;
}

const LOCALE_LABEL: Record<Locale, string> = { en: "EN", el: "ΕΛ" };

export interface ConsumerNavProps {
  /** Campus display name shown next to the K. */
  campusName: string;
  /** Per-org logo image, used in place of the wordmark when set. */
  logoUrl?: string;
  /** Token in the URL — used to build the nav links. */
  token: string;
}

/**
 * Consumer nav: white, hairline-bottom, K logo + wordmark on the
 * left, text links centre-right, language toggle on the far right.
 *
 * Mounted from the campus layout (not per-page) so it persists
 * across navigations — the body unmounts on each route change but
 * this stays put, giving the public surface a native-app feel
 * instead of a full-page reload flash. Same applies to
 * `CampusBottomNav` below the fold.
 *
 * Reads the locale from `useSearchParams` (the `?lang=` URL param)
 * rather than taking it as a prop, because layouts can't receive
 * `searchParams` in Next 15 — only pages can. Pulling it client-side
 * here keeps the locale toggle working without a server roundtrip
 * per nav.
 */
export function ConsumerNav({
  campusName,
  logoUrl,
  token,
}: ConsumerNavProps) {
  const searchParams = useSearchParams();
  const locale = detectLocale(searchParams?.get("lang") ?? null);
  const lang = `?lang=${locale}`;
  const links: NavLink[] = [
    { label: "Home", href: `/campus/${token}${lang}` },
    { label: "Map", href: `/campus/${token}/map${lang}` },
    { label: "Explore", href: `/campus/${token}/events${lang}` },
    { label: "Klio", href: `/campus/${token}/klio${lang}` },
  ];

  return (
    <header className="sticky top-0 z-20 bg-white">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href={`/campus/${token}${lang}`}
          className="flex shrink-0 items-center gap-2"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={campusName}
              className="h-10 max-w-[180px] rounded-xl object-contain"
            />
          ) : (
            <>
              <KLogo size={36} />
              <span className="text-base font-medium text-[var(--brand-text)]">
                {campusName}
              </span>
            </>
          )}
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 md:flex"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-normal text-[var(--brand-text)] transition-colors hover:text-[var(--brand-primary)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-line)] bg-white p-0.5">
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <Link
                key={l}
                href={`/campus/${token}?lang=${l}`}
                aria-current={active ? "true" : undefined}
                className="rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: "var(--brand-primary)",
                        color: "#fff",
                      }
                    : { color: "var(--brand-text-muted)" }
                }
              >
                {LOCALE_LABEL[l]}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
