import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ASSISTANT_TOOLS,
  executeTool,
  type AssistantAction,
  type AssistantSpace,
  type AssistantToolName,
  type ToolContext,
} from "@/lib/assistant/tools";
import { checkRateLimit, clientIp } from "@/lib/assistant/rate-limit";
import { loadAssistantSpacesForProject } from "@/lib/assistant/spaces-loader";
import {
  parseKlioConfig,
  personaPromptFragment,
  type KlioConfig,
} from "@/lib/klio-config";
import { prisma } from "@/lib/prisma";
import { decryptSecret, secretsEnabled } from "@/lib/secrets";

/**
 * Resolve the API key for a chat turn — per-campus stored key first,
 * server-wide `ANTHROPIC_API_KEY` second. The campus key lives
 * encrypted in `Project.anthropicApiKeyEncrypted`; decrypt failures
 * (rotated SECRETS_KEY, stale ciphertext) fall through to the env
 * var so the chat stays usable.
 */
async function resolveAnthropicKey(
  mapId: string,
): Promise<string | undefined> {
  if (secretsEnabled()) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: mapId },
        select: { anthropicApiKeyEncrypted: true },
      });
      if (project?.anthropicApiKeyEncrypted) {
        return decryptSecret(project.anthropicApiKeyEncrypted);
      }
    } catch (err) {
      console.error("[assistant] per-campus key lookup failed", err);
    }
  }
  return process.env.ANTHROPIC_API_KEY ?? undefined;
}

/**
 * Read `sceneData.klio` and narrow it to a `KlioConfig`. Errors fall
 * through to the default config so a flaky DB doesn't kill the chat
 * — defaults are safe (every tool enabled, neutral persona).
 */
async function loadKlioConfig(mapId: string): Promise<KlioConfig> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: mapId },
      select: { sceneData: true },
    });
    const scene = (project?.sceneData ?? null) as
      | { klio?: unknown }
      | null;
    return parseKlioConfig(scene?.klio);
  } catch (err) {
    console.error("[assistant] klio config lookup failed", err);
    return parseKlioConfig(null);
  }
}

interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

interface RequestBody {
  /** Current user message. */
  message: string;
  /** Project id — every DB query is scoped here. */
  mapId: string;
  /** MappedIn spaces — present on the map chat, empty on the home chat. */
  spaces?: AssistantSpace[];
  /** Prior turns for multi-turn context. Server is stateless. */
  history?: AssistantTurn[];
  /** UI locale — passed through into the system prompt. */
  locale?: "en" | "el";
  /** Campus display name — system prompt + replies use this. */
  campusName?: string;
}

interface AssistantReply {
  reply: string;
  /** Backward-compat: the *last* focus/route action as a single suggestion. */
  suggested?: AssistantAction;
  /** All collected actions in order — preferred for newer callers. */
  actions?: AssistantAction[];
}

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 1024;

function systemPrompt(
  campusName: string,
  locale: string,
  klio: KlioConfig,
): string {
  // Build the active-tools list so we can both name them in the
  // prompt and skip instructions for disabled ones — Claude follows
  // a shorter prompt more reliably than one that says "do X" then
  // hides the X tool from the registry.
  const t = klio.tools;
  const activeQueryTools = [
    t.query_news && "news",
    t.query_events && "events",
    t.query_clubs && "clubs",
    t.query_dining && "dining",
  ].filter(Boolean) as string[];

  const lines: string[] = [
    `You are the friendly assistant for the ${campusName} campus app.`,
    "",
    "You help students find " +
      (activeQueryTools.length > 0
        ? `${activeQueryTools.join(", ")}, and rooms on campus.`
        : "rooms on campus."),
    "Be concise — answers fit in 2-3 short sentences whenever possible.",
    "Always prefer tool calls over guessing. If a tool returns nothing,",
    "say so plainly. Cite places, events, and clubs by name.",
    "",
  ];

  if (t.search_places) {
    lines.push(
      "When the user mentions a place (gym, library, room 201), call",
      "`search_places` first.",
    );
  }
  if (t.focus || t.route) {
    const both = t.focus && t.route;
    const onlyFocus = t.focus && !t.route;
    const onlyRoute = !t.focus && t.route;
    lines.push(
      `If the map context is available (spaces > 0), you can ${
        both
          ? "call `focus` (to point at a single space) or `route` (for 'from X to Y' style questions)"
          : onlyFocus
            ? "call `focus` to point at a single space"
            : onlyRoute
              ? "call `route` for 'from X to Y' style questions"
              : ""
      }.`,
    );
    if (t.route) {
      lines.push(
        "Mark a route `accessible: true` when the user mentions wheelchair, step-free, accessibility, αναπηρ, or προσβάσιμ.",
      );
    }
    lines.push("");
  }

  if (activeQueryTools.length > 0) {
    lines.push(
      `If the user asks about ${activeQueryTools.join(", ")}, call the`,
      "matching `query_*` tool. Filter by anchor when the user names a",
      "building. Don't list more than ~5 results unless asked.",
      "",
    );
  }

  if (t.cite) {
    lines.push(
      "**Always cite your sources.** When you mention a specific club,",
      "event, news post, or dining venue you fetched, call `cite(kind,",
      "id, name)` so the student gets a tappable card linking to it in",
      "the app. One `cite` per mention; up to 4 per response. Don't",
      "cite something you didn't fetch.",
    );
  }
  if (t.focus || t.route) {
    lines.push(
      "For spaces, pass the human-readable name to `focus` / `route`",
      "(`toName`, `fromName`) so the directions card reads 'Library'",
      "instead of an id.",
    );
  }

  lines.push(
    "",
    locale === "el"
      ? "Απαντήστε στα ελληνικά όταν ο χρήστης γράφει στα ελληνικά."
      : "Reply in the language of the user's question.",
  );

  const persona = personaPromptFragment(klio.persona);
  if (persona) {
    lines.push("", persona);
  }

  return lines.join("\n");
}

/** Filter the static tool registry down to whatever the rector has
 *  left enabled. We never mutate `ASSISTANT_TOOLS` — Anthropic's
 *  Tool type is shared by reference across requests, and a concurrent
 *  splice would scramble other tenants. */
function activeToolsFor(klio: KlioConfig) {
  return ASSISTANT_TOOLS.filter((tool) => {
    const name = tool.name as AssistantToolName;
    return klio.tools[name] !== false;
  });
}

/**
 * Lightweight intent parser used when `ANTHROPIC_API_KEY` is unset.
 * Same shape we shipped in Arc 1's assistant — handles the common
 * "from X to Y" / "show me X" routing patterns. News + events
 * questions return a "set the key" hint instead of guessing.
 */
function fallbackParse(
  message: string,
  spaces: AssistantSpace[],
): AssistantReply {
  const text = message.toLowerCase();
  const accessible =
    /wheelchair|accessible|step.?free|αναπηρ|προσβάσιμ/.test(text);

  const findSpace = (raw: string): AssistantSpace | undefined => {
    const cleaned = raw.trim().toLowerCase().replace(/[?.!,]+$/, "");
    if (!cleaned) return undefined;
    return (
      spaces.find((s) => s.name.toLowerCase() === cleaned) ??
      spaces.find(
        (s) =>
          s.name.length > 2 && cleaned.includes(s.name.toLowerCase()),
      )
    );
  };

  const fromTo = text.match(/from\s+(.+?)\s+to\s+(.+?)(?:[?.!]+|$)/);
  if (fromTo) {
    const from = findSpace(fromTo[1]);
    const to = findSpace(fromTo[2]);
    if (from && to) {
      const action: AssistantAction = {
        action: "route",
        fromId: from.id,
        toId: to.id,
        accessible,
      };
      return {
        reply: `Routing from ${from.name} to ${to.name}${accessible ? " (step-free)" : ""}.`,
        suggested: action,
        actions: [action],
      };
    }
  }

  const toOnly = text.match(
    /(?:to|reach|find|show(?: me)?|where(?:'s| is))\s+(?:the\s+)?(.+?)(?:[?.!]+|$)/,
  );
  const candidate = toOnly ? toOnly[1] : message;
  const match = findSpace(candidate);
  if (match) {
    const action: AssistantAction = { action: "focus", toId: match.id };
    return {
      reply: `Showing ${match.name} on the map.`,
      suggested: action,
      actions: [action],
    };
  }

  return {
    reply:
      "AI search isn't enabled here yet. Try the dropdowns above, or " +
      "ask an admin to set ANTHROPIC_API_KEY to power the chat.",
  };
}

/**
 * Run the LLM with tool-use until it stops calling tools or hits the
 * iteration cap. Returns the final assistant text + the collected
 * focus/route actions.
 */
async function runClaude(
  client: Anthropic,
  body: RequestBody,
  ctx: ToolContext,
  klio: KlioConfig,
): Promise<AssistantReply> {
  const messages: Anthropic.Messages.MessageParam[] = [
    ...(body.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    { role: "user", content: body.message },
  ];

  const tools = activeToolsFor(klio);
  const system = systemPrompt(
    body.campusName ?? "the",
    body.locale ?? "en",
    klio,
  );

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: tools as unknown as Anthropic.Messages.Tool[],
      messages,
    });

    // End of turn — collect the assistant text and return.
    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      const text = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        reply: text || "I'm not sure how to answer that.",
        suggested: ctx.collectedActions.at(-1),
        actions: ctx.collectedActions,
      };
    }

    if (response.stop_reason !== "tool_use") {
      // Defensive — refusal / max_tokens / other.
      return {
        reply:
          "Sorry — I couldn't put together a useful answer. Try the dropdowns above.",
        actions: ctx.collectedActions,
      };
    }

    // Run each tool the model asked for, then loop with the results.
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const out = await executeTool(
        block.name,
        block.input as Record<string, unknown>,
        ctx,
      );
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(out),
      });
    }
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "I took too many steps to answer that — try a more specific question.",
    actions: ctx.collectedActions,
  };
}

export async function POST(req: Request) {
  // Public endpoint, paid LLM — token-bucket the caller's IP so a
  // tab loop or a small abuse campaign can't run the bill. See
  // lib/assistant/rate-limit.ts for the swap-out story (Upstash).
  const ip = clientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "Too many requests — slow down for a minute.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.resetIn / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message || !body.mapId) {
    return NextResponse.json(
      { error: "message + mapId required" },
      { status: 400 },
    );
  }

  // If the caller already has a MappedIn viewer open it sends the
  // visible spaces along — use those. Otherwise (Klio tab, home chat,
  // any tab without a viewer) fall back to a cached server-side load
  // from the campus's `indoorMapId` so directions / focus questions
  // don't dead-end with "open the map first". Empty when no venue is
  // configured.
  const callerSpaces = Array.isArray(body.spaces) ? body.spaces : [];
  const spaces =
    callerSpaces.length > 0
      ? callerSpaces
      : await loadAssistantSpacesForProject(body.mapId);
  // Per-campus BYOK first, platform key second. Each chat turn does
  // one extra Project read by id (cuid lookup, fast); per-tenant key
  // means usage + cost scope to the right buyer. We also pull the
  // Klio config from sceneData so the rector's tool / persona /
  // notes settings take effect on every turn.
  const [apiKey, klio] = await Promise.all([
    resolveAnthropicKey(body.mapId),
    loadKlioConfig(body.mapId),
  ]);

  // No key → keep the basic regex parser alive. The chat input is
  // still visible everywhere; without a key it only handles the
  // simple "from X to Y" / "show me X" patterns on the map context.
  if (!apiKey) {
    return NextResponse.json(fallbackParse(body.message, spaces));
  }

  const ctx: ToolContext = {
    projectId: body.mapId,
    spaces,
    collectedActions: [],
  };

  try {
    const client = new Anthropic({ apiKey });
    const reply = await runClaude(client, body, ctx, klio);
    return NextResponse.json(reply);
  } catch (err) {
    console.error("[/api/assistant] Claude call failed", err);
    // Fall back to the regex parser so the chat doesn't appear broken.
    return NextResponse.json(fallbackParse(body.message, spaces));
  }
}
