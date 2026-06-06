/**
 * Thin Firecrawl wrapper — one URL → markdown.
 *
 * Firecrawl's JS SDK ships a `scrape` method that returns a rich
 * response (markdown, html, screenshots, metadata). We pin the
 * formats to `markdown` so the LLM extractor only sees text, and we
 * surface only what the runner needs. Any SDK shape drift stays
 * isolated to this file.
 */
import FirecrawlApp from "@mendable/firecrawl-js";

export interface FirecrawlScrapeResult {
  ok: boolean;
  markdown: string;
  /** Truncated to the page's <title> when present, otherwise null. */
  title: string | null;
  /** Surfaced when ok is false. */
  error?: string;
}

export interface FirecrawlClient {
  scrape(url: string): Promise<FirecrawlScrapeResult>;
}

/** Construct a client bound to one API key. Throws synchronously if
 *  the key is empty — callers should have already checked
 *  `features.crawler` before reaching this. */
export function createFirecrawlClient(apiKey: string): FirecrawlClient {
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not set");
  }
  const app = new FirecrawlApp({ apiKey });
  return {
    async scrape(url: string): Promise<FirecrawlScrapeResult> {
      try {
        const res = (await app.scrapeUrl(url, {
          formats: ["markdown"],
        })) as unknown as {
          success?: boolean;
          markdown?: string;
          metadata?: { title?: string };
          error?: string;
        };
        if (!res.success || typeof res.markdown !== "string") {
          return {
            ok: false,
            markdown: "",
            title: null,
            error: res.error ?? "Firecrawl returned no markdown",
          };
        }
        return {
          ok: true,
          markdown: res.markdown,
          title:
            typeof res.metadata?.title === "string"
              ? res.metadata.title.slice(0, 200)
              : null,
        };
      } catch (err) {
        return {
          ok: false,
          markdown: "",
          title: null,
          error: err instanceof Error ? err.message : "Firecrawl threw",
        };
      }
    },
  };
}
