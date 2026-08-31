import { z } from "zod";

/**
 * Multilingual content, as stored.
 *
 * §9.1 requires a minimum of five languages per tenant and says explicitly
 * "extensible", and §6.1 notes Greek tenders specify three to five languages
 * plus international sign language. A column-per-language shape caps the set;
 * a row-per-translation shape turns every read of a list into a join fan-out.
 * So every translatable field is a `Json` map of BCP-47 tag to string, and
 * this module is the only place that knows that.
 *
 *   { "en": "Cycladic figurine", "el": "Κυκλαδικό ειδώλιο" }
 */
export type LocalizedText = Record<string, string>;

/** Loose on purpose: tenants add languages without a migration. */
export const localizedTextSchema = z.record(
  z.string().min(2).max(35),
  z.string(),
);

/**
 * Resolve one string for a reader.
 *
 * Falls back deliberately rather than returning empty: a visitor who asked for
 * Greek and gets English has a worse experience than a native speaker, but a
 * visitor who gets a blank label has no experience at all. Order is requested
 * language, then the venue default, then any populated value.
 *
 * Returns `null` only when nothing is populated, so callers can distinguish
 * "not translated yet" from "translated to empty string" and show a curator
 * the difference (§7.2.10 requires human approval before publication, which
 * means the console has to be able to see what is missing).
 */
export function pickLocalized(
  value: unknown,
  language: string,
  defaultLanguage = "en",
): string | null {
  const map = asLocalizedText(value);
  if (!map) return null;

  const candidates = [language, baseLanguage(language), defaultLanguage];
  for (const tag of candidates) {
    if (!tag) continue;
    const hit = map[tag];
    if (typeof hit === "string" && hit.trim() !== "") return hit;
  }
  for (const hit of Object.values(map)) {
    if (typeof hit === "string" && hit.trim() !== "") return hit;
  }
  return null;
}

/** `el-GR` → `el`. Returns null when the tag has no region subtag. */
function baseLanguage(tag: string): string | null {
  const dash = tag.indexOf("-");
  return dash > 0 ? tag.slice(0, dash) : null;
}

/** Narrow a Prisma `Json` column to a LocalizedText, or null if it isn't one. */
export function asLocalizedText(value: unknown): LocalizedText | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as LocalizedText;
}

/**
 * Which of a venue's languages this field is still missing. Drives the
 * translation workflow (§7.2.10) and the per-language completeness a curator
 * needs before publishing.
 */
export function missingLanguages(
  value: unknown,
  languages: readonly string[],
): string[] {
  const map = asLocalizedText(value) ?? {};
  return languages.filter((tag) => {
    const hit = map[tag];
    return typeof hit !== "string" || hit.trim() === "";
  });
}

/** True when every one of the venue's languages is populated. */
export function isFullyTranslated(
  value: unknown,
  languages: readonly string[],
): boolean {
  return missingLanguages(value, languages).length === 0;
}
