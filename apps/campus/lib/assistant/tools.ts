/**
 * Assistant tool definitions + executor (Arc 6 of campus-consumer-pivot).
 *
 * The LLM (Claude Haiku 4.5) sees these as `input_schema`-typed
 * tools and decides which to call. The executor on the server runs
 * the call against either the supplied `spaces` array (for place
 * search) or the per-project Prisma reads we built in Arcs 2-5.
 *
 * `focus` and `route` don't return data — they register an action
 * the response collects, so the client can dispatch it to the map.
 */
import { listNewsForProject } from "@/lib/news";
import { listUpcomingEventsForProject } from "@/lib/events-db";
import { listTopClubsForProject } from "@/lib/clubs-db";
import { listDiningForProject } from "@/lib/dining-db";

/** A space passed in from the MappedIn-aware client (map chat). */
export interface AssistantSpace {
  id: string;
  name: string;
  type?: string;
}

/** A client-dispatchable action the LLM asked us to suggest. */
export type AssistantAction =
  | { action: "focus"; toId: string }
  | { action: "route"; fromId: string; toId: string; accessible: boolean };

/** Execution context the executor needs to run a tool call. */
export interface ToolContext {
  /** Project id — every DB query is scoped here. */
  projectId: string;
  /** Optional MappedIn spaces — only present on the map chat. */
  spaces: AssistantSpace[];
  /** Mutated as the LLM calls `focus` / `route`. */
  collectedActions: AssistantAction[];
}

/**
 * Tool definitions — one block per tool. Descriptions are part of
 * the LLM's prompt at every call, so keep them concrete + tight.
 *
 * Tools are *always defined* but the LLM is told in the system
 * prompt that `search_places` / `focus` / `route` only work when
 * spaces are available — without spaces, those tools return an
 * empty list / a "not available" note and Claude routes around them.
 */
export const ASSISTANT_TOOLS = [
  {
    name: "search_places",
    description:
      "Find buildings or rooms on this campus by free-text query. " +
      "Returns up to 5 matches with their MappedIn id and name. " +
      "Use this whenever the user mentions a place name (gym, library, " +
      "room 201, …). When no spaces are available (the user is on the " +
      "home page, not the map), returns an empty list — say so.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text place name, e.g. 'gym', 'library', 'room 201'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "query_news",
    description:
      "Recent campus news posts, newest first. Filter by an anchor " +
      "(building/room name) if the user mentioned one. Default limit 5.",
    input_schema: {
      type: "object",
      properties: {
        anchorRefName: {
          type: "string",
          description:
            "Filter to posts that mention this building/room name (case-insensitive). Optional.",
        },
        limit: { type: "number", default: 5, maximum: 20 },
      },
    },
  },
  {
    name: "query_events",
    description:
      "Upcoming campus events, soonest first. Filter by anchor or by " +
      "time window (ISO 8601). Default limit 10.",
    input_schema: {
      type: "object",
      properties: {
        anchorRefName: {
          type: "string",
          description:
            "Filter to events at this building/room name (case-insensitive). Optional.",
        },
        startsAfter: {
          type: "string",
          description: "ISO 8601 — only events starting on/after this. Optional.",
        },
        endsBefore: {
          type: "string",
          description: "ISO 8601 — only events ending on/before this. Optional.",
        },
        limit: { type: "number", default: 10, maximum: 30 },
      },
    },
  },
  {
    name: "query_clubs",
    description:
      "Most active student clubs, ranked. Optionally filter by name " +
      "substring. Default limit 5.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Filter to clubs whose name contains this string. Optional.",
        },
        limit: { type: "number", default: 5, maximum: 20 },
      },
    },
  },
  {
    name: "query_dining",
    description:
      "All cafeterias / cafes on campus, alphabetical. Useful for " +
      "'where can I eat' / 'what's open for lunch' questions.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "focus",
    description:
      "Tell the map to focus on a specific space. Use after " +
      "`search_places` to point the user at a single building or room. " +
      "Call at most once per response.",
    input_schema: {
      type: "object",
      properties: {
        toId: {
          type: "string",
          description: "The MappedIn space id from `search_places`.",
        },
      },
      required: ["toId"],
    },
  },
  {
    name: "route",
    description:
      "Tell the map to draw a route between two spaces. Use when the " +
      "user asks 'from X to Y' or 'how do I get from A to B'. Call at " +
      "most once per response.",
    input_schema: {
      type: "object",
      properties: {
        fromId: { type: "string" },
        toId: { type: "string" },
        accessible: {
          type: "boolean",
          description:
            "true when the user mentions wheelchair, step-free, accessibility, αναπηρ, προσβάσιμ.",
          default: false,
        },
      },
      required: ["fromId", "toId"],
    },
  },
] as const;

export type ToolName = (typeof ASSISTANT_TOOLS)[number]["name"];

/** Loose place search — exact / contains / digit-match. Cap at 5. */
function searchPlaces(query: string, spaces: AssistantSpace[]) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact = spaces.filter((s) => s.name.toLowerCase() === q);
  const contains = spaces.filter(
    (s) =>
      s.name.length > 2 &&
      s.name.toLowerCase() !== q &&
      s.name.toLowerCase().includes(q),
  );
  const digits = q.match(/\d+/)?.[0];
  const numMatch = digits
    ? spaces.filter(
        (s) =>
          !exact.includes(s) &&
          !contains.includes(s) &&
          s.name.includes(digits),
      )
    : [];
  return [...exact, ...contains, ...numMatch].slice(0, 5).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
  }));
}

/** Case-insensitive substring match across an anchor's `refName`s. */
function matchesAnchor(
  rowAnchors: { refName: string }[],
  refName: string | undefined,
): boolean {
  if (!refName) return true;
  const q = refName.toLowerCase();
  return rowAnchors.some((a) => a.refName.toLowerCase().includes(q));
}

/**
 * Execute a single tool call. Each branch is intentionally
 * defensive — empty arrays beat throwing on the LLM's side.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  try {
    switch (name) {
      case "search_places": {
        const q = typeof input.query === "string" ? input.query : "";
        if (ctx.spaces.length === 0) {
          return {
            results: [],
            note: "No MappedIn spaces in this context — the user is on the home page, not the map. Suggest opening the map page instead.",
          };
        }
        return { results: searchPlaces(q, ctx.spaces) };
      }

      case "query_news": {
        const limit = Math.min(
          typeof input.limit === "number" ? input.limit : 5,
          20,
        );
        const anchor =
          typeof input.anchorRefName === "string"
            ? input.anchorRefName
            : undefined;
        const all = await listNewsForProject(ctx.projectId, 50);
        const filtered = all
          .filter((p) => matchesAnchor(p.anchors, anchor))
          .slice(0, limit)
          .map((p) => ({
            id: p.id,
            title: p.title,
            excerpt:
              p.body.length > 160 ? `${p.body.slice(0, 157)}…` : p.body,
            category: p.category,
            publishedAt: p.publishedAt,
            anchors: p.anchors.map((a) => a.refName),
          }));
        return { results: filtered };
      }

      case "query_events": {
        const limit = Math.min(
          typeof input.limit === "number" ? input.limit : 10,
          30,
        );
        const anchor =
          typeof input.anchorRefName === "string"
            ? input.anchorRefName
            : undefined;
        const startsAfter =
          typeof input.startsAfter === "string"
            ? new Date(input.startsAfter)
            : null;
        const endsBefore =
          typeof input.endsBefore === "string"
            ? new Date(input.endsBefore)
            : null;
        const all = await listUpcomingEventsForProject(ctx.projectId, 50);
        const filtered = all
          .filter((e) => matchesAnchor(e.anchors, anchor))
          .filter((e) => {
            if (startsAfter && new Date(e.startsAt) < startsAfter) return false;
            if (endsBefore && new Date(e.endsAt) > endsBefore) return false;
            return true;
          })
          .slice(0, limit)
          .map((e) => ({
            id: e.id,
            title: e.title,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            anchors: e.anchors.map((a) => a.refName),
            blurb:
              e.description.length > 160
                ? `${e.description.slice(0, 157)}…`
                : e.description,
            organizer: e.organizer,
            registrationUrl: e.registrationUrl,
          }));
        return { results: filtered };
      }

      case "query_clubs": {
        const limit = Math.min(
          typeof input.limit === "number" ? input.limit : 5,
          20,
        );
        const q =
          typeof input.query === "string"
            ? input.query.toLowerCase()
            : null;
        const all = await listTopClubsForProject(ctx.projectId, 30);
        const filtered = all
          .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
          .slice(0, limit)
          .map((c) => ({
            id: c.id,
            name: c.name,
            memberCount: c.memberCount,
            meetsCadence: c.meetsCadence,
            externalLink: c.externalLink,
          }));
        return { results: filtered };
      }

      case "query_dining": {
        const all = await listDiningForProject(ctx.projectId);
        return {
          results: all.map((d) => ({
            id: d.id,
            name: d.name,
            cuisine: d.cuisine,
            hoursText: d.hoursText,
            anchors: d.anchors.map((a) => a.refName),
            menuUrl: d.menuUrl,
          })),
        };
      }

      case "focus": {
        const toId = typeof input.toId === "string" ? input.toId : "";
        if (!toId) return { ok: false, error: "toId is required" };
        if (ctx.spaces.length === 0) {
          return {
            ok: false,
            error:
              "No MappedIn context — say to open the map instead of focusing.",
          };
        }
        ctx.collectedActions.push({ action: "focus", toId });
        return { ok: true };
      }

      case "route": {
        const fromId = typeof input.fromId === "string" ? input.fromId : "";
        const toId = typeof input.toId === "string" ? input.toId : "";
        const accessible = input.accessible === true;
        if (!fromId || !toId) {
          return { ok: false, error: "fromId and toId are required" };
        }
        if (ctx.spaces.length === 0) {
          return {
            ok: false,
            error:
              "No MappedIn context — say to open the map instead of drawing a route.",
          };
        }
        ctx.collectedActions.push({
          action: "route",
          fromId,
          toId,
          accessible,
        });
        return { ok: true };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error("[assistant.executeTool]", name, err);
    return { error: "Tool execution failed" };
  }
}
