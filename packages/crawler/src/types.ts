/**
 * Shapes that flow between the crawler runner and its callers.
 *
 * The package is intentionally **DB-agnostic** — it never imports
 * Prisma. The caller owns persistence: it hands the runner a list of
 * URLs, gets back `ExtractedItem[]` (raw shape, no ids) per URL, and
 * decides what to write where. Same package, different apps, same
 * extraction surface.
 */

/** Content type the extractor was asked to look for. Apps register
 *  one schema per type via `ExtractorProfile`; the LLM emits each
 *  type it can find on a page in one structured call. */
export type ContentType = "news" | "event";

/** What the extractor returns for one URL. */
export interface PageExtraction {
  /** The source URL the markdown was scraped from. Echoed back so
   *  callers can persist `sourceUrl` on each item without bookkeeping. */
  sourceUrl: string;
  /** Status of the scrape — `ok` when Firecrawl returned markdown,
   *  `scrape_failed` when the page could not be fetched, `empty` when
   *  the markdown was returned but had no extractable content. */
  status: "ok" | "scrape_failed" | "empty";
  /** Items the LLM extracted, grouped by content type. Empty arrays
   *  on non-`ok` statuses. */
  items: ExtractedItem[];
  /** When `status !== "ok"`, a one-line reason. */
  error?: string;
}

/** A single extracted item — content-type-tagged, payload is the
 *  shape the matching `ExtractorProfile` schema described. The caller
 *  routes by `type` and trusts `payload` to match the registered
 *  schema (the LLM is forced to via tool-use, so this isn't blind). */
export interface ExtractedItem {
  type: ContentType;
  /** The structured payload — typed loosely here so the package can
   *  stay app-agnostic. The caller narrows it per `type`. */
  payload: Record<string, unknown>;
}

/** Per-app registration: what content types this app cares about and
 *  the JSON Schema the LLM should fill for each. Schemas are passed
 *  to Anthropic via `tools` and forced via `tool_choice`. */
export interface ExtractorProfile {
  /** Friendly id — logged on jobs, surfaced in UI. */
  appKey: string;
  /** System prompt prefix — describes the domain (e.g. "Greek HE
   *  campus"). The package layers the tool-use instructions on top. */
  systemPrompt: string;
  /** Per content-type JSON Schema for the tool input. The package
   *  forwards these verbatim to Anthropic. */
  schemas: Partial<Record<ContentType, Record<string, unknown>>>;
}

/** Input to the runner. */
export interface RunnerInput {
  urls: string[];
  /** Optional rector-supplied instructions. Length-capped by the
   *  caller via `CRAWLER_DEMO_LIMITS.maxInstructionsLength` before
   *  reaching the runner. */
  instructions?: string;
  profile: ExtractorProfile;
}

/** Output of the runner — one entry per input URL, same order. */
export interface RunnerOutput {
  pages: PageExtraction[];
  /** Sum of items across pages. */
  totalItems: number;
}
