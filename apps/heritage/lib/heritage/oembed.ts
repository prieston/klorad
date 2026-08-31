import "server-only";

/**
 * oEmbed provider plumbing (§7.4.2, HER-402).
 *
 * §11 moved this from Phase 2 to Phase 1 because §4.4 reframed it: under the
 * single-renderer decision the photoreal viewer layer is the product's front
 * line, and this endpoint is the wedge. It does three things at once — it is
 * how a museum embeds its own objects in its own website, it is the
 * replacement for Sketchfab embeds as Sketchfab declines, and it is the
 * technical prerequisite for Europeana rendering Klorad-hosted 3D, since
 * Europeana resolves `edm:isShownBy` through an internal oEmbed registry and
 * accepts conformant viewers on request.
 *
 * §7.4.2 lists five conformance requirements and warns that each is a place a
 * multi-tenant platform accidentally breaks embedding. They are treated here
 * as acceptance criteria, not aspirations:
 *
 *   1. a stable public URL pattern            → CANONICAL_PATTERNS below
 *   2. a working discovery endpoint           → /api/oembed + <link rel=alternate>
 *   3. a rich type with correct dimensions    → buildRichResponse
 *   4. no authentication                      → the routes live outside /org
 *   5. works cross-origin in someone else's   → frame-ancestors, and no
 *      iframe                                    X-Frame-Options anywhere
 */

/** Default embed box. 16:10 suits an orbiting object better than 16:9. */
export const DEFAULT_EMBED_WIDTH = 640;
export const DEFAULT_EMBED_HEIGHT = 400;
export const MIN_EMBED_WIDTH = 240;
export const MIN_EMBED_HEIGHT = 180;

/**
 * The public URL shapes this provider answers for. Kept in one place because
 * a registry entry elsewhere (Europeana's, a CMS plugin's) is written against
 * exactly these, and changing one silently breaks every embed already in the
 * wild.
 */
export const CANONICAL_PATTERNS = [
  "/v/{venue}/o/{object}",
  "/v/{venue}/s/{scene}",
] as const;

export type EmbedTarget =
  | { kind: "object"; venueSlug: string; slug: string }
  | { kind: "scene"; venueSlug: string; slug: string };

/**
 * Parse a canonical public URL into what it points at.
 *
 * Accepts an absolute URL or a path. Returns null for anything that is not one
 * of the documented patterns rather than guessing — an oEmbed provider that
 * answers for URLs it does not own is worse than one that 404s.
 */
export function parseCanonicalUrl(input: string): EmbedTarget | null {
  let path: string;
  try {
    path = input.startsWith("/") ? input : new URL(input).pathname;
  } catch {
    return null;
  }

  const parts = path.split("/").filter(Boolean);
  // ["v", venue, "o"|"s", slug]
  if (parts.length !== 4 || parts[0] !== "v") return null;
  const [, venueSlug, kindSegment, slug] = parts;
  if (kindSegment === "o") return { kind: "object", venueSlug, slug };
  if (kindSegment === "s") return { kind: "scene", venueSlug, slug };
  return null;
}

/** The chrome-free route the iframe actually points at. */
export function embedPathFor(target: EmbedTarget): string {
  const segment = target.kind === "object" ? "o" : "s";
  return `/embed/v/${target.venueSlug}/${segment}/${target.slug}`;
}

/** The canonical page an embed links back to. */
export function canonicalPathFor(target: EmbedTarget): string {
  const segment = target.kind === "object" ? "o" : "s";
  return `/v/${target.venueSlug}/${segment}/${target.slug}`;
}

export function clampDimension(
  requested: string | null,
  fallback: number,
  min: number,
): number {
  if (!requested) return fallback;
  const n = Number.parseInt(requested, 10);
  if (!Number.isFinite(n)) return fallback;
  // A consumer's maxwidth is a ceiling, not a target — never return more than
  // asked for, and never return something unusably small.
  return Math.max(min, Math.min(n, fallback));
}

export interface RichResponseInput {
  origin: string;
  target: EmbedTarget;
  title: string;
  authorName: string;
  maxWidth: string | null;
  maxHeight: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Build the oEmbed `rich` payload.
 *
 * Field names and required members follow the oEmbed 1.0 spec: `type`,
 * `version`, `html`, `width` and `height` are required for `rich`; the rest
 * are optional but are what makes a consumer's card look like anything.
 */
export function buildRichResponse(input: RichResponseInput) {
  const width = clampDimension(input.maxWidth, DEFAULT_EMBED_WIDTH, MIN_EMBED_WIDTH);
  const height = clampDimension(
    input.maxHeight,
    DEFAULT_EMBED_HEIGHT,
    MIN_EMBED_HEIGHT,
  );

  const src = `${input.origin}${embedPathFor(input.target)}`;
  const html =
    `<iframe src="${escapeAttribute(src)}" width="${width}" height="${height}" ` +
    `frameborder="0" allowfullscreen ` +
    // xr-spatial-tracking is here so the same embed can enter immersive mode
    // when that ships, without every existing embed needing to be re-pasted.
    `allow="xr-spatial-tracking; fullscreen" ` +
    `title="${escapeAttribute(input.title)}" ` +
    `style="border:0;max-width:100%"></iframe>`;

  return {
    type: "rich" as const,
    version: "1.0" as const,
    provider_name: "Klorad Heritage",
    provider_url: input.origin,
    title: input.title,
    author_name: input.authorName,
    author_url: `${input.origin}/v/${input.target.venueSlug}`,
    html,
    width,
    height,
    ...(input.thumbnailUrl ? { thumbnail_url: input.thumbnailUrl } : {}),
    // Consumers cache the payload; a day is long enough to be useful and short
    // enough that a re-published record is not stale for a week.
    cache_age: 86400,
  };
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
