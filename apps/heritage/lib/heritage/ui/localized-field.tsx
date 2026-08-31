"use client";

import { Field, Input, Textarea } from "@klorad/design-system";
import { missingLanguages } from "@/lib/heritage/i18n";

export type LocalizedValue = Record<string, string>;

/**
 * A translatable text field: one control per venue language.
 *
 * §9.1 makes every content field multilingual with a minimum of five
 * languages per tenant, so a single input backed by a hidden "current
 * language" is the wrong shape — it hides how much is untranslated, and
 * §7.2.10 requires human approval per language before publication. Showing
 * every language at once means a curator cannot publish a half-translated
 * record without having seen that it is half-translated.
 *
 * Deliberately local to apps/heritage for now. It is a plausible lift to
 * @klorad/design-system once a second vertical needs per-language authoring —
 * Campus is bilingual by a different mechanism, so there is no second consumer
 * yet and lifting now would be guessing at the shape.
 */
export function LocalizedField({
  label,
  hint,
  value,
  languages,
  defaultLanguage,
  onChange,
  multiline = false,
  placeholder,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: LocalizedValue;
  languages: readonly string[];
  defaultLanguage: string;
  onChange: (next: LocalizedValue) => void;
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const missing = missingLanguages(value, languages);
  const Control = multiline ? Textarea : Input;

  return (
    <Field
      label={label}
      hint={
        missing.length > 0
          ? `${hint ? `${hint} · ` : ""}Missing: ${missing.join(", ")}`
          : hint
      }
    >
      <div className="space-y-2">
        {languages.map((tag) => (
          <div key={tag} className="flex items-start gap-2">
            <span
              className={`mt-2 w-9 shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] ${
                tag === defaultLanguage ? "text-accent" : "text-text-tertiary"
              }`}
            >
              {tag}
            </span>
            <Control
              value={value[tag] ?? ""}
              placeholder={placeholder}
              {...(multiline ? { rows } : {})}
              onChange={(
                e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) => onChange({ ...value, [tag]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </Field>
  );
}

/** Strip empty strings so a field that was never filled stays absent rather
 *  than storing `{ el: "" }`, which `pickLocalized` would treat as present-
 *  but-blank and `missingLanguages` would have to special-case forever. */
export function compactLocalized(value: LocalizedValue): LocalizedValue {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v.trim() !== ""),
  );
}
