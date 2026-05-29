import Link from "next/link";
import { KLogo } from "./KLogo";
import { LOCALES, type Locale } from "@/app/lib/i18n-core";

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
  /** Locale appended to every link so language survives navigation. */
  locale: Locale;
}

/**
 * Consumer nav: white, hairline-bottom, K logo + wordmark on the
 * left, text links centre-right, language toggle / map CTA on the
 * far right. On mobile every link is hidden — only the logo +
 * wordmark stay visible so the bar never wraps to two rows.
 */
export function ConsumerNav({
  campusName,
  logoUrl,
  token,
  locale,
}: ConsumerNavProps) {
  const lang = `?lang=${locale}`;
  const links: NavLink[] = [
    { label: "Map", href: `/campus/${token}/map${lang}` },
    { label: "Events", href: `/campus/${token}/events${lang}` },
    { label: "Clubs", href: `/campus/${token}/clubs${lang}` },
    { label: "Dining", href: `/campus/${token}/dining${lang}` },
    { label: "News", href: `/campus/${token}/news${lang}` },
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
              className="h-7 max-w-[160px] object-contain"
            />
          ) : (
            <>
              <KLogo />
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
