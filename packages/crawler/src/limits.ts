/**
 * Demo-tier limits for the agentic crawler.
 *
 * Hardcoded constants in v1 — they're imported wherever a guard is
 * needed (API handlers, UI counters) so the cap is consistent and
 * changing it is a one-line edit. Production tenants will lift these
 * via the billing plan in Phase 4; until then the values below are
 * what every project gets.
 *
 * Why a cap at all: Firecrawl + Claude calls cost real money per
 * page. A buggy rector who pastes a sitemap URL by mistake could
 * burn the demo budget in one click. The cap is the hard backstop.
 */
export const CRAWLER_DEMO_LIMITS = {
  /** Max URLs a single job will scrape. */
  maxUrlsPerJob: 5,
  /** Max DiscoveredItems pending review per project before new
   *  crawls are blocked — pushes rectors to triage before piling on. */
  maxPendingItems: 100,
  /** Max characters of free-text instructions the rector can pass
   *  to the extractor. Long enough for a useful nudge, short enough
   *  to cap prompt-injection blast radius. */
  maxInstructionsLength: 500,
} as const;

export type CrawlerDemoLimits = typeof CRAWLER_DEMO_LIMITS;
