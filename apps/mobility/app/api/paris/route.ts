/**
 * POST /api/paris
 *   Body: `{ message, worldId, history? }`
 *
 * Read-only conversational assistant scoped to a single mobility
 * world. Follows Klorad's per-project Anthropic pattern (per-tenant
 * key first, `ANTHROPIC_API_KEY` env fallback second), plus
 * Anthropic tool-use with the four `PARIS_TOOLS` — alerts,
 * device status, device listings by subsystem, and rule catalogue.
 *
 * Tool iterations cap at 5 (same as Campus's Klio) so a runaway
 * loop can't run up a bill. Returns `{reply: string, actions: []}`
 * shaped for the DS `AssistantPanel` primitive.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { decryptSecret, secretsEnabled } from "@klorad/secrets";
import { prisma } from "@/lib/prisma";
import {
  PARIS_TOOLS,
  executeParisTool,
  type ParisToolAction,
  type ParisToolName,
} from "@/lib/paris/tools";
import { loadWorldForPushViewer } from "@/lib/mobility/world-resolver";

interface RequestBody {
  message: string;
  worldId: string;
  history?: { role: "user" | "assistant"; text: string }[];
}

const MAX_TOOL_ITERATIONS = 5;
const MODEL = "claude-sonnet-4-6";

/** Per-project key first (stored encrypted on `Project`), env-var
 *  fallback second. Decrypt failures (rotated `SECRETS_KEY`, stale
 *  ciphertext) log but fall through so the assistant stays usable
 *  on the platform key. Same shape as Campus's `resolveAnthropicKey`. */
async function resolveAnthropicKey(
  projectId: string,
): Promise<string | undefined> {
  if (secretsEnabled()) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { anthropicApiKeyEncrypted: true },
      });
      if (project?.anthropicApiKeyEncrypted) {
        return decryptSecret(project.anthropicApiKeyEncrypted);
      }
    } catch (err) {
      console.error("[paris] per-project key lookup failed", err);
    }
  }
  return process.env.ANTHROPIC_API_KEY ?? undefined;
}

/** System prompt — kept short and behaviour-focused. Paris is a
 *  read-only concierge; the tool list is the contract for what it
 *  can look at. */
function systemPrompt(worldName: string): string {
  return `You are Paris, a concierge assistant for the Klorad Mobility world "${worldName}".

You help visitors understand what's happening on this world's map. You have four read-only tools:
- get_open_alerts: list currently-open alerts on devices in this world
- get_device_status: fetch live status for a specific device (returns cameras' stream URL, DMS messages, radar speed/volume/occupancy, VSLS speed limits, AID event counts)
- list_devices_by_subsystem: list every camera / DMS / radar / etc. in the world — use this to find a device by name before calling get_device_status
- list_alert_rules: what conditions trigger notifications

Rules:
- Use tools whenever the answer would benefit from live data — never invent device values.
- When the user asks about a specific device by name ("show me the K9 camera", "what's the DMS on Flyover saying"), first call list_devices_by_subsystem to find it, then get_device_status on the id. This surfaces a deep-link card the user can tap to see the live video / message / telemetry in a rich detail sheet.
- If the user asks something you can't answer with these tools (control a device, send a notification, change a setting), say so plainly.
- Keep answers concise. If you cite a device or alert, mention its name + a one-line summary; the UI surfaces a deep-link card automatically — you don't need to describe it.
- Never expose IDs unless asked directly.`;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = body.message?.trim();
  const worldId = body.worldId?.trim();
  if (!message || !worldId) {
    return NextResponse.json(
      { error: "message and worldId required" },
      { status: 400 },
    );
  }

  // Resolve the world through the same auth gate the public
  // endpoints use, so authenticated worlds only respond for granted
  // viewers.
  const world = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: { slug: true, name: true, projectId: true, isPublished: true },
  });
  if (!world) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const resolved = await loadWorldForPushViewer(world.slug);
  if (!resolved) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const apiKey = await resolveAnthropicKey(world.projectId);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No Anthropic key configured — set one in the project's AI settings or the ANTHROPIC_API_KEY env var.",
      },
      { status: 503 },
    );
  }

  const client = new Anthropic({ apiKey });
  const history = (body.history ?? []).map((t) => ({
    role: t.role,
    content: t.text,
  }));
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: message },
  ];

  const collectedActions: ParisToolAction[] = [];
  let replyText = "";

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(world.name),
        tools: [...PARIS_TOOLS] as unknown as Anthropic.Tool[],
        messages,
      });

      // Collect any text blocks (may be interleaved with tool_use).
      for (const block of res.content) {
        if (block.type === "text") replyText += block.text;
      }

      // If the model asked for tools, execute them and loop.
      const toolUseBlocks = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (toolUseBlocks.length === 0 || res.stop_reason !== "tool_use") {
        break;
      }

      const toolResults: Anthropic.MessageParam = {
        role: "user",
        content: await Promise.all(
          toolUseBlocks.map(async (tu) => {
            const result = await executeParisTool(
              tu.name as ParisToolName,
              (tu.input ?? {}) as Record<string, unknown>,
              { worldId, projectId: world.projectId },
            );
            if (result.actions) collectedActions.push(...result.actions);
            return {
              type: "tool_result" as const,
              tool_use_id: tu.id,
              content: JSON.stringify(result.reply),
            };
          }),
        ),
      };
      messages.push({ role: "assistant", content: res.content });
      messages.push(toolResults);
    }

    return NextResponse.json({
      reply: replyText.trim() || "…",
      actions: collectedActions,
    });
  } catch (err) {
    console.error("[paris] assistant call failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "assistant failed" },
      { status: 502 },
    );
  }
}
