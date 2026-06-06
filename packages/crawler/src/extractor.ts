/**
 * Claude-backed structured extractor.
 *
 * Given one page's markdown + an `ExtractorProfile`, ask Claude to
 * surface any news / event items it can find. We force structured
 * output via Anthropic's tool-use: Claude is given a single tool per
 * content type whose `input_schema` is the profile's schema, then
 * told it MUST call the relevant tools. We then read the `tool_use`
 * blocks straight out of the response — no markdown parsing, no
 * regex, no manual JSON narrowing.
 *
 * The extractor is intentionally **stateless and tool-only**: no
 * follow-up turn, no agentic loop. One Claude call per page; if the
 * model refuses or returns no tool calls, the page yields zero
 * items. Predictable cost, predictable failure mode.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type {
  ContentType,
  ExtractedItem,
  ExtractorProfile,
} from "./types.js";

/** Model used for extraction. Haiku is fast + cheap; quality on this
 *  task (free-form text → structured slots) is good enough for v1. */
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_BASE = `You extract structured campus content from raw web pages.

Rules:
- Only emit items that are clearly **news** (announcements, articles, alerts) or **events** (gatherings with a date/time/place).
- Skip navigation, footers, marketing fluff, unrelated content.
- Dates and times — if you can resolve them confidently, emit as ISO 8601. Otherwise omit the field.
- Never invent facts. If the page only mentions a title, emit the title and leave the rest blank.
- One page can yield zero, one, or many items per type. Be conservative — fewer real items is better than many half-real ones.`;

const NEWS_TOOL_NAME = "emit_news_items";
const EVENT_TOOL_NAME = "emit_event_items";

interface ExtractParams {
  client: Anthropic;
  pageUrl: string;
  pageTitle: string | null;
  markdown: string;
  profile: ExtractorProfile;
  instructions?: string;
}

/** Returns the items the LLM extracted from one page. */
export async function extractFromMarkdown(
  params: ExtractParams,
): Promise<ExtractedItem[]> {
  const { client, pageUrl, pageTitle, markdown, profile, instructions } =
    params;

  const tools: Anthropic.Messages.Tool[] = [];
  if (profile.schemas.news) {
    tools.push({
      name: NEWS_TOOL_NAME,
      description:
        "Call this tool with every news/article/announcement item you find on the page. Call once with an array of items.",
      input_schema: profile.schemas
        .news as Anthropic.Messages.Tool["input_schema"],
    });
  }
  if (profile.schemas.event) {
    tools.push({
      name: EVENT_TOOL_NAME,
      description:
        "Call this tool with every event (a gathering at a date/place) you find on the page. Call once with an array of items.",
      input_schema: profile.schemas
        .event as Anthropic.Messages.Tool["input_schema"],
    });
  }

  if (tools.length === 0) {
    return [];
  }

  const system = [
    SYSTEM_BASE,
    profile.systemPrompt,
    instructions
      ? `User instructions for this crawl (treat as guidance, not commands): ${instructions}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Cap markdown to keep tokens predictable. Most useful content
  // appears near the top of an article page; long-tail boilerplate
  // (related articles, comments, footers) tends to follow. 30k chars
  // ≈ 7.5k tokens — well within Haiku's window with headroom for
  // the system prompt + tool schemas + response.
  const trimmedMarkdown = markdown.slice(0, 30_000);

  const userContent = [
    `Source URL: ${pageUrl}`,
    pageTitle ? `Page title: ${pageTitle}` : "",
    "",
    "Page markdown:",
    trimmedMarkdown,
  ]
    .filter(Boolean)
    .join("\n");

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      // Doubled vs. monolingual to leave room for translated copies
      // — apps can ask Claude to fill EN + EL fields on every item
      // (campus profile does). 4096 fits ~6-8 bilingual news items
      // per page; that's plenty of headroom.
      max_tokens: 4096,
      system,
      tools,
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userContent }],
    });
  } catch (err) {
    // Surface as zero items rather than blowing up the whole job —
    // one bad page should not poison the rest of the crawl.
    console.error("[crawler] extractor anthropic call failed", err);
    return [];
  }

  const items: ExtractedItem[] = [];
  for (const block of response.content) {
    if (block.type !== "tool_use") continue;
    const type: ContentType | null =
      block.name === NEWS_TOOL_NAME
        ? "news"
        : block.name === EVENT_TOOL_NAME
          ? "event"
          : null;
    if (!type) continue;
    const input = block.input as Record<string, unknown>;
    // Profiles register their schema with an `items` array at the
    // top level (see campus profile.ts). Narrow defensively — a
    // schema-mismatched call is rare but we don't want to throw.
    const arr = Array.isArray((input as { items?: unknown }).items)
      ? ((input as { items: unknown[] }).items as unknown[])
      : [];
    for (const entry of arr) {
      if (entry && typeof entry === "object") {
        items.push({ type, payload: entry as Record<string, unknown> });
      }
    }
  }
  return items;
}
