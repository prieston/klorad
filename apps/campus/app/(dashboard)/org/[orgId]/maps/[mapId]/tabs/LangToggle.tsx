"use client";

import { cn } from "@klorad/design-system";
import { LOCALES, type Locale } from "@/app/lib/i18n-core";

const LABEL: Record<Locale, string> = { en: "EN", el: "ΕΛ" };

/**
 * EN / ΕΛ toggle for the content editors. Campus-authored text is
 * bilingual; the editors hold both languages and show one at a time —
 * this switches which one you're editing.
 */
export function LangToggle({
  value,
  onChange,
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === l
              ? "bg-accent text-accent-contrast"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
