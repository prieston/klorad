import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import { loadMappedinSpaces } from "@/lib/mappedin/spaces";
import type { AssistantSpace } from "@/lib/assistant/tools";

/**
 * Server-side load of a campus's MappedIn spaces for the assistant.
 *
 * Bridges the gap that surfaced after Klio's source-cards work shipped:
 * the chat tab and the home-page chat input both call `/api/assistant`
 * without `spaces[]` in the body (they don't have a MappedIn viewer
 * loaded), so Klio's `search_places` / `focus` / `route` tools were
 * unconditionally refusing with "open the map first". When the
 * campus has an indoor venue configured, we can resolve the same
 * spaces server-side and pass them as context — so Klio answers
 * directions questions from any tab.
 *
 * Cached aggressively: the spaces list rarely changes (it's the
 * venue's authored geometry), and the per-call cost would otherwise
 * be a MappedIn round-trip + an SDK init on every assistant turn.
 * `unstable_cache` keys on the indoor map id and revalidates on a
 * 1-hour TTL; tagged so a future "venue updated" hook can
 * invalidate just the affected campus.
 */
async function loadSpacesByIndoorMapIdUncached(
  indoorMapId: string,
): Promise<AssistantSpace[]> {
  if (!indoorMapId) return [];
  try {
    const venue = venueForIndoorMap(indoorMapId);
    const options = await loadMappedinSpaces(venue);
    return options
      .filter((o) => o.name && o.id)
      .map((o) => ({
        id: o.id,
        name: o.name,
        type: o.kind,
      }));
  } catch (err) {
    console.error("[assistant] MappedIn space load failed", err);
    return [];
  }
}

function spacesCache(indoorMapId: string) {
  return unstable_cache(
    () => loadSpacesByIndoorMapIdUncached(indoorMapId),
    ["assistant-spaces", indoorMapId],
    {
      revalidate: 3600,
      tags: [`mappedin-spaces:${indoorMapId}`],
    },
  );
}

/**
 * Top-level entry point for the assistant route. Looks up the
 * campus's indoorMapId, loads the cached spaces if there is one,
 * returns `[]` otherwise (no venue → no spatial context, same as
 * before — Klio just routes around the spatial tools).
 */
export async function loadAssistantSpacesForProject(
  mapId: string,
): Promise<AssistantSpace[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: mapId },
      select: { sceneData: true },
    });
    const indoorMapId =
      (project?.sceneData as { indoorMapId?: string } | null)?.indoorMapId ??
      null;
    if (!indoorMapId) return [];
    return await spacesCache(indoorMapId)();
  } catch (err) {
    console.error("[assistant] indoor map lookup failed", err);
    return [];
  }
}
