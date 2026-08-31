/**
 * URL-safe slugs for public paths — `/v/<venue>`, and the per-venue segments
 * that objects, scenes and tours address themselves by.
 *
 * Transliterates Greek before stripping, because the first tenants are Greek
 * institutions and a venue named "Αρχαία Όλυνθος" would otherwise slugify to
 * an empty string and the curator would be told their name is unusable.
 */
const GREEK_MAP: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps",
  ω: "o",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    // Strip combining marks first, so Greek accents and Latin diacritics both
    // reduce to their base letter before transliteration.
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((ch) => GREEK_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
