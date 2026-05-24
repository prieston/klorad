import { NextResponse } from "next/server";

interface SpaceInput {
  id: string;
  name: string;
  type?: string;
}

interface RequestBody {
  message: string;
  spaces: SpaceInput[];
  locale?: "en" | "el";
}

type Suggestion =
  | { action: "focus"; toId: string }
  | { action: "route"; fromId: string; toId: string; accessible: boolean };

interface AssistantReply {
  reply: string;
  suggested?: Suggestion;
}

/** Loose match — exact, then "text contains a space name," then by digits. */
function findSpace(text: string, spaces: SpaceInput[]): SpaceInput | undefined {
  const cleaned = text.trim().toLowerCase().replace(/[?.!,]+$/, "");
  if (!cleaned) return undefined;
  const exact = spaces.find((s) => s.name.toLowerCase() === cleaned);
  if (exact) return exact;
  const containing = spaces.find(
    (s) => s.name.length > 2 && cleaned.includes(s.name.toLowerCase()),
  );
  if (containing) return containing;
  const num = cleaned.match(/\d+/)?.[0];
  if (num) {
    const numMatch = spaces.find((s) => s.name.includes(num));
    if (numMatch) return numMatch;
  }
  return undefined;
}

/**
 * Lightweight intent parser — no LLM needed. Handles the common
 * student-facing patterns:
 *   - "How do I get to room 201?"           → focus room 201
 *   - "From the gym to the library"         → route gym → library
 *   - "I use a wheelchair, reach the lab"   → focus lab, accessible
 *   - "Show me the cafeteria"               → focus cafeteria
 *
 * When ANTHROPIC_API_KEY is set in the env, this is where a Claude
 * tool-use call belongs — same return shape, much smarter matching.
 * That's a follow-up; this fallback ships a usable assistant today.
 */
function parseMessage(message: string, spaces: SpaceInput[]): AssistantReply {
  const text = message.toLowerCase();
  const accessible =
    /wheelchair|accessible|step.?free|αναπηρ|προσβάσιμ/.test(text);

  // "from X to Y" pattern
  const fromTo = text.match(/from\s+(.+?)\s+to\s+(.+?)(?:[?.!]+|$)/);
  if (fromTo) {
    const fromMatch = findSpace(fromTo[1], spaces);
    const toMatch = findSpace(fromTo[2], spaces);
    if (fromMatch && toMatch) {
      return {
        reply: `Routing from ${fromMatch.name} to ${toMatch.name}${accessible ? " (step-free)" : ""}.`,
        suggested: {
          action: "route",
          fromId: fromMatch.id,
          toId: toMatch.id,
          accessible,
        },
      };
    }
  }

  // "to X" / "reach X" / "find X" / "where's X" / single-space match
  const toOnly = text.match(
    /(?:to|reach|find|show(?: me)?|where(?:'s| is))\s+(?:the\s+)?(.+?)(?:[?.!]+|$)/,
  );
  const candidate = toOnly ? toOnly[1] : message;
  const match = findSpace(candidate, spaces);
  if (match) {
    return {
      reply: `Showing ${match.name} on the map${accessible ? " — pick a starting point and we'll route step-free." : "."}`,
      suggested: { action: "focus", toId: match.id },
    };
  }

  return {
    reply:
      "I couldn't match a room from that. Try a room name or number (e.g. \"201\" or \"library\"), or use the dropdowns above.",
  };
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message || !Array.isArray(body.spaces)) {
    return NextResponse.json(
      { error: "message + spaces required" },
      { status: 400 },
    );
  }
  return NextResponse.json(parseMessage(body.message, body.spaces));
}
