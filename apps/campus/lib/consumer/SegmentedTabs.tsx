import Link from "next/link";

export type SegmentedTabKey = "news" | "events" | "clubs" | "dining";

export interface SegmentedTabsProps {
  /** Token in the public URL — used to build the tab hrefs. */
  token: string;
  /** Lang suffix already including `?lang=…`. */
  lang: string;
  /** Locale — drives label translation. */
  locale: "en" | "el";
  /** The tab currently in view. */
  active: SegmentedTabKey;
}

const LABELS: Record<SegmentedTabKey, Record<"en" | "el", string>> = {
  news: { en: "News", el: "Νέα" },
  events: { en: "Events", el: "Εκδηλώσεις" },
  clubs: { en: "Clubs", el: "Σύλλογοι" },
  dining: { en: "Dining", el: "Φαγητό" },
};

const ORDER: SegmentedTabKey[] = ["news", "events", "clubs", "dining"];

/**
 * Pill-style segmented control for the Explore surface — News /
 * Events / Clubs / Dining live as siblings of one another. The
 * active pill fills with the brand accent; inactive pills are
 * outline-only with a hover state.
 *
 * Each tab is a real `<Link>` so the URL stays canonical
 * (`/campus/[token]/events`) and back/forward works naturally —
 * client-side switching would silently lose the deep-link.
 */
export function SegmentedTabs({
  token,
  lang,
  locale,
  active,
}: SegmentedTabsProps) {
  return (
    <nav
      aria-label="Explore"
      className="mt-6 flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--brand-line)] bg-white p-1"
    >
      {ORDER.map((key) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={`/campus/${token}/${key}${lang}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors"
                : "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-[var(--brand-text-muted)] transition-colors hover:bg-[var(--brand-page)] hover:text-[var(--brand-text)]"
            }
          >
            {LABELS[key][locale]}
          </Link>
        );
      })}
    </nav>
  );
}
