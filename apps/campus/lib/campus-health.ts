import "server-only";
import { prisma } from "@/lib/prisma";

export interface HealthCheck {
  /** Stable id used by the client to render an icon and order. */
  key:
    | "branding"
    | "mappedin"
    | "published"
    | "news"
    | "events"
    | "clubs"
    | "dining"
    | "klio";
  /** Title shown next to the green/empty dot. */
  title: string;
  /** One-line hint shown under the title. */
  hint: string;
  done: boolean;
}

export interface CampusHealth {
  /** How many checks pass — drives the X/Y progress label. */
  passed: number;
  /** Total number of checks. */
  total: number;
  checks: HealthCheck[];
  /** Counts surfaced separately so the dashboard can show them
   *  in stat cards / hints without re-running the check arithmetic. */
  counts: {
    pois: number;
    accessibleSpaces: number;
    news: number;
    events: number;
    clubs: number;
    dining: number;
    /** % of POIs flagged wheelchair-accessible, 0–100. */
    accessibilityPct: number;
    /** Buildings linked by POIs. */
    buildings: number;
  };
}

interface ScenePoiObject {
  meta?: {
    poi?: {
      accessibility?: { wheelchairAccessible?: boolean };
      linkedBuilding?: unknown;
    };
  };
}

interface SceneShape {
  objects?: ScenePoiObject[];
  branding?: {
    name?: string;
    logo?: string;
    primaryColor?: string;
    indoorMapId?: string;
  };
}

/**
 * One-shot snapshot of a campus's readiness — drives the Campus
 * Dashboard's Campus Health checklist + stat cards.
 *
 * Lives server-side so a single call counts News / Events / Clubs /
 * Dining rows in parallel instead of the dashboard firing 4 separate
 * fetches. Also avoids exposing per-row data the dashboard never
 * needs — just totals and booleans.
 *
 * Each `done` check is a green dot on the dashboard; the count of
 * passes is the progress bar's numerator.
 */
export async function readCampusHealth(mapId: string): Promise<CampusHealth | null> {
  const [project, newsCount, eventsCount, clubsCount, diningCount] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: mapId },
        select: {
          id: true,
          title: true,
          isPublished: true,
          sceneData: true,
          anthropicApiKeyEncrypted: true,
        },
      }),
      prisma.newsPost.count({ where: { projectId: mapId } }).catch(() => 0),
      prisma.eventPost.count({ where: { projectId: mapId } }).catch(() => 0),
      prisma.club.count({ where: { projectId: mapId } }).catch(() => 0),
      prisma.diningLocation
        .count({ where: { projectId: mapId } })
        .catch(() => 0),
    ]);

  if (!project) return null;

  const scene = (project.sceneData ?? {}) as SceneShape;
  const objects = scene.objects ?? [];
  const pois = objects.filter((o) => o?.meta?.poi);
  const accessibleSpaces = pois.filter(
    (p) => p?.meta?.poi?.accessibility?.wheelchairAccessible,
  ).length;
  const buildings = pois.filter((p) => p?.meta?.poi?.linkedBuilding).length;
  const accessibilityPct =
    pois.length > 0 ? Math.round((accessibleSpaces / pois.length) * 100) : 0;

  const branding = scene.branding ?? {};
  const brandingDone = Boolean(
    project.title && branding.logo && branding.primaryColor,
  );
  const mappedinDone = Boolean(branding.indoorMapId);
  const klioDone = Boolean(project.anthropicApiKeyEncrypted);

  const checks: HealthCheck[] = [
    {
      key: "branding",
      title: "Branding is complete",
      hint: "Name, logo and primary colour all set.",
      done: brandingDone,
    },
    {
      key: "mappedin",
      title: "MappedIn venue connected",
      hint: "Anchors can deep-link into the map.",
      done: mappedinDone,
    },
    {
      key: "published",
      title: "Campus is published",
      hint: "Drafts aren't visible to students.",
      done: Boolean(project.isPublished),
    },
    {
      key: "news",
      title: "At least 1 news post",
      hint:
        newsCount > 0
          ? `${newsCount} published`
          : "Drives the home news rail.",
      done: newsCount >= 1,
    },
    {
      key: "events",
      title: "3+ events scheduled",
      hint: eventsCount > 0 ? `Currently ${eventsCount}` : "Powers Today.",
      done: eventsCount >= 3,
    },
    {
      key: "clubs",
      title: "1+ club published",
      hint: clubsCount > 0 ? `${clubsCount} clubs` : "Anchor of campus life.",
      done: clubsCount >= 1,
    },
    {
      key: "dining",
      title: "1+ dining location",
      hint:
        diningCount > 0
          ? `${diningCount} venues`
          : "Drives Dining now on home.",
      done: diningCount >= 1,
    },
    {
      key: "klio",
      title: "Klio enabled",
      hint: klioDone
        ? "Anthropic key set — Claude is live."
        : "Add an API key to unlock the assistant.",
      done: klioDone,
    },
  ];

  return {
    passed: checks.filter((c) => c.done).length,
    total: checks.length,
    checks,
    counts: {
      pois: pois.length,
      accessibleSpaces,
      news: newsCount,
      events: eventsCount,
      clubs: clubsCount,
      dining: diningCount,
      accessibilityPct,
      buildings,
    },
  };
}
