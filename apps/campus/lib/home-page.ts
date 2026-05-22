/**
 * Public home page configuration.
 *
 * Stored in the campus `sceneData` (`sceneData.homePage`) — the same
 * store branding, posts and event feeds use. Every field is optional:
 * the public home page falls back to the campus name, description and
 * thumbnail when a field is unset, so an unconfigured campus still
 * renders a sensible page.
 */
export interface HomePageConfig {
  /** Uploaded hero banner image URL. Falls back to the campus thumbnail. */
  heroImage?: string;
  /** Hero headline. Falls back to the campus (branding) name. */
  headline?: string;
  /** Hero tagline. Falls back to the campus description. */
  tagline?: string;
  /** Label of the map CTA. Falls back to "Explore the campus map". */
  ctaLabel?: string;
  /** Show the upcoming-events section. Defaults to true. */
  showEvents?: boolean;
  /** Show the news section. Defaults to true. */
  showNews?: boolean;
}

/** Read the home page config from a campus's `sceneData`. */
export function readHomePage(sceneData: unknown): HomePageConfig {
  const raw = (sceneData as { homePage?: unknown } | null | undefined)
    ?.homePage;
  if (!raw || typeof raw !== "object") return {};
  return raw as HomePageConfig;
}
