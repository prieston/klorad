/**
 * Job runner — scrape each URL, extract each page, collect results.
 *
 * Sequential per page, parallel-safe overall: callers can invoke the
 * runner concurrently across projects without contention. We don't
 * fan out scrapes within a single job because Firecrawl's free tier
 * is rate-limited and the demo cap is 5 URLs anyway — sequential is
 * simpler than a parallel pool that adds 5ms of orchestration to
 * save 200ms of wall time.
 *
 * No persistence. The caller owns the DB write.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { FirecrawlClient } from "./firecrawl.js";
import { extractFromMarkdown } from "./extractor.js";
import type {
  PageExtraction,
  RunnerInput,
  RunnerOutput,
} from "./types.js";

export interface RunnerDeps {
  firecrawl: FirecrawlClient;
  anthropic: Anthropic;
}

export async function runCrawl(
  deps: RunnerDeps,
  input: RunnerInput,
): Promise<RunnerOutput> {
  const pages: PageExtraction[] = [];
  for (const url of input.urls) {
    const scrape = await deps.firecrawl.scrape(url);
    if (!scrape.ok) {
      pages.push({
        sourceUrl: url,
        status: "scrape_failed",
        items: [],
        error: scrape.error,
      });
      continue;
    }
    if (!scrape.markdown.trim()) {
      pages.push({ sourceUrl: url, status: "empty", items: [] });
      continue;
    }
    const items = await extractFromMarkdown({
      client: deps.anthropic,
      pageUrl: url,
      pageTitle: scrape.title,
      markdown: scrape.markdown,
      profile: input.profile,
      instructions: input.instructions,
    });
    pages.push({
      sourceUrl: url,
      status: "ok",
      items,
    });
  }
  const totalItems = pages.reduce((acc, p) => acc + p.items.length, 0);
  return { pages, totalItems };
}
