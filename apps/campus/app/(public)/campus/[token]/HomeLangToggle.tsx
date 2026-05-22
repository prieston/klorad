import Link from "next/link";
import { cn } from "@klorad/design-system";
import { LOCALES, type Locale } from "@/app/lib/i18n-core";

const LABEL: Record<Locale, string> = { en: "EN", el: "ΕΛ" };

/**
 * EN / ΕΛ switcher for the public campus home page. The home page is
 * server-rendered and reads `?lang`, so switching is just a link to
 * the same page with a different `lang` param — no client state.
 */
export function HomeLangToggle({
  token,
  current,
}: {
  token: string;
  current: Locale;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/campus/${token}?lang=${l}`}
          aria-current={l === current ? "true" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            l === current
              ? "bg-accent text-accent-contrast"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {LABEL[l]}
        </Link>
      ))}
    </div>
  );
}
