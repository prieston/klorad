import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { ToursClient } from "./ToursClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Tours" };

/**
 * HER-207 — the tour and story builder.
 *
 * One definition drives both the on-screen virtual tour and the in-headset
 * guided walk (§7.1.4). Stops are ordered and edited as a sequence, then saved
 * in a single request — the API replaces the whole set, so a reorder cannot
 * half-apply.
 */
export default async function ToursPage({ params }: { params: Params }) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { languages: true, defaultLanguage: true },
  });
  if (!venue) notFound();

  const [tours, scenes, objects] = await Promise.all([
    prisma.heritageTour.findMany({
      where: { venueId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { stops: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.heritageScene.findMany({
      where: { venueId },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, title: true },
    }),
    prisma.heritageObject.findMany({
      where: { venueId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, title: true },
    }),
  ]);

  const lang = venue.defaultLanguage;

  return (
    <ToursClient
      venueId={venueId}
      languages={venue.languages}
      defaultLanguage={lang}
      scenes={scenes.map((s) => ({
        id: s.id,
        label: pickLocalized(s.title, lang, "en") ?? s.slug,
      }))}
      objects={objects.map((o) => ({
        id: o.id,
        label: pickLocalized(o.title, lang, "en") ?? o.slug,
      }))}
      initial={tours.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: (t.title ?? {}) as Record<string, string>,
        description: (t.description ?? {}) as Record<string, string>,
        mode: t.mode,
        state: t.state,
        estimatedMinutes: t.estimatedMinutes,
        isAccessibleRoute: t.isAccessibleRoute,
        stops: t.stops.map((s) => ({
          sceneId: s.sceneId,
          objectId: s.objectId,
          title: (s.title ?? {}) as Record<string, string>,
          body: (s.body ?? {}) as Record<string, string>,
        })),
      }))}
    />
  );
}
