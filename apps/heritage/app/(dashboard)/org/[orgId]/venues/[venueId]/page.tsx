import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { PageHeader } from "@/lib/heritage/ui/page-header";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Start here" };

/**
 * The first screen of a venue, and for a new user the first screen of the
 * product.
 *
 * It answers three questions in order, because a newcomer asks them in order:
 * what is this thing, what do I do first, and is any of it live yet.
 *
 * Written as a sequence rather than a dashboard. A grid of counters tells
 * someone who already understands the product how much of it they have; it
 * tells someone who does not what a Representation is, which is nothing. Each
 * step here says what the concept means in a sentence, shows whether it is
 * done, and links to the one place it is done.
 *
 * Steps stop being prominent once complete, so the page shrinks as the venue
 * matures instead of nagging a curator who has been using it for a year.
 */
export default async function StartHerePage({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: {
      slug: true,
      name: true,
      defaultLanguage: true,
      languages: true,
      project: { select: { isPublished: true } },
      _count: {
        select: {
          objects: true,
          spaces: true,
          scenes: true,
          tours: true,
          representations: true,
          proxies: true,
        },
      },
    },
  });
  if (!venue) notFound();

  const base = `/org/${orgId}/venues/${venueId}`;
  const lang = venue.defaultLanguage;

  const [viewable, publishedObjects, publishedScenes] = await Promise.all([
    prisma.heritageRepresentation.count({
      where: { venueId, status: "ready", files: { some: { purpose: "delivery" } } },
    }),
    prisma.heritageObject.count({ where: { venueId, state: "published" } }),
    prisma.heritageScene.count({ where: { venueId, state: "published" } }),
  ]);

  const steps = [
    {
      title: "Add your first item",
      what:
        "An item is one thing in your collection — a statue, a vase, a building. Upload its 3D model or photo and give it a name; that is the whole first step.",
      done: venue._count.objects > 0,
      detail:
        venue._count.objects > 0
          ? `${venue._count.objects} item${venue._count.objects === 1 ? "" : "s"}, ${viewable} with a viewable file`
          : null,
      href: `${base}/items/new`,
      cta: "Add an item",
    },
    {
      title: "Build a scene",
      what:
        "A scene is a 3D space you arrange items in — a gallery, a dig site, a reconstructed room. Visitors move around it. One item on its own does not need a scene; a room full of them does.",
      done: venue._count.scenes > 0,
      detail:
        venue._count.scenes > 0
          ? `${venue._count.scenes} scene${venue._count.scenes === 1 ? "" : "s"}, ${publishedScenes} published`
          : null,
      href: `${base}/scenes`,
      cta: "Create a scene",
    },
    {
      title: "Add points of interest",
      what:
        "Tappable spots inside a scene. You click a place on the model and attach a label to it, so a visitor can tap the pediment and read about the pediment.",
      done: venue._count.proxies > 0,
      detail:
        venue._count.proxies > 0
          ? `${venue._count.proxies} point${venue._count.proxies === 1 ? "" : "s"} placed`
          : null,
      href: `${base}/proxies`,
      cta: "Place points",
      // Nothing to place them on until a scene exists.
      blockedBy: venue._count.scenes === 0 ? "Create a scene first" : null,
    },
    {
      title: "Make a tour",
      what:
        "A guided route through your scenes and items, in an order you choose, with a short piece of writing at each stop. Optional — plenty of collections work without one.",
      done: venue._count.tours > 0,
      detail:
        venue._count.tours > 0
          ? `${venue._count.tours} tour${venue._count.tours === 1 ? "" : "s"}`
          : null,
      href: `${base}/tours`,
      cta: "Create a tour",
      optional: true,
    },
    {
      title: "Publish",
      what:
        "Two switches, on purpose. Each item, scene and tour has its own — and the venue has one in Settings. Nothing is public until both are on, which is what lets you build in the open without half-finished records leaking.",
      done: venue.project.isPublished && publishedObjects > 0,
      detail: venue.project.isPublished
        ? `Venue is live · ${publishedObjects} item${publishedObjects === 1 ? "" : "s"} published`
        : "Venue is not published yet",
      href: `${base}/settings`,
      cta: "Open settings",
    },
  ];

  const remaining = steps.filter((s) => !s.done && !s.optional).length;
  const title = pickLocalized(venue.name, lang, "en") ?? venue.slug;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-10">
      <PageHeader
        title={`${title}.`}
        lede={
          remaining === 0
            ? "Everything is set up. This page stays as a map of how the pieces fit together."
            : "Five steps from an empty venue to something a visitor can walk through. Nothing here has to be done in one sitting."
        }
        actions={
          venue.project.isPublished ? (
            <a
              href={`/v/${venue.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line-soft px-4 py-2 text-xs text-text-secondary transition hover:bg-surface-2"
            >
              View the public page
              <ExternalLink size={12} strokeWidth={1.8} aria-hidden />
            </a>
          ) : null
        }
      />

      {venue.languages.length <= 1 ? (
        // Raised here rather than buried in Settings because it is the one
        // decision that is expensive to change later: every text field asks
        // for one box per language, so adding a second language in week three
        // means revisiting everything already written.
        <p className="mb-8 flex items-start gap-2 rounded-2xl border border-line-soft bg-surface-1 p-4 text-xs leading-relaxed text-text-secondary">
          <AlertTriangle
            size={13}
            strokeWidth={1.8}
            aria-hidden
            className="mt-0.5 shrink-0 text-amber-600"
          />
          <span>
            This venue is set up for one language. If you intend to publish in
            more, add them in{" "}
            <Link href={`${base}/settings`} className="text-accent hover:underline">
              Settings
            </Link>{" "}
            before you write much — every description asks for one box per
            language, and adding one later means going back over everything.
          </span>
        </p>
      ) : null}

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className={`rounded-2xl border p-5 transition ${
              step.done
                ? "border-line-soft bg-transparent"
                : "border-line-soft bg-bg"
            }`}
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                  step.done
                    ? "bg-emerald-500/12 text-emerald-600"
                    : "bg-surface-2 text-text-tertiary"
                }`}
              >
                {step.done ? <Check size={12} strokeWidth={2.4} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-text-primary">
                  {step.title}
                  {step.optional ? (
                    <span className="text-[11px] font-normal text-text-tertiary">
                      Optional
                    </span>
                  ) : null}
                </p>

                {/* The explanation is shown until the step is done, then
                    hidden. Someone who has built four scenes does not need to
                    be told what a scene is every time they open the page. */}
                {!step.done ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {step.what}
                  </p>
                ) : null}

                {step.detail ? (
                  <p className="mt-1.5 text-xs text-text-tertiary">{step.detail}</p>
                ) : null}

                {step.blockedBy ? (
                  <p className="mt-2 text-xs text-text-tertiary">{step.blockedBy}</p>
                ) : (
                  <Link
                    href={step.href}
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      step.done
                        ? "text-accent hover:underline"
                        : "bg-accent text-accent-contrast hover:opacity-90"
                    }`}
                  >
                    {step.done ? null : <Plus size={12} strokeWidth={2} aria-hidden />}
                    {step.done ? "Open" : step.cta}
                    {step.done ? (
                      <ArrowRight size={12} strokeWidth={1.9} aria-hidden />
                    ) : null}
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 border-t border-line-soft pt-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          The rest of the sidebar
        </h2>
        <dl className="space-y-2.5 text-sm">
          {[
            ["Files", "Every uploaded file, and whether it processed. Go here when something you uploaded is not showing up."],
            ["Places", "Rooms, galleries and sites. Used to say where an item physically is."],
            ["Copyright", "What each item and each file may be used for, and by whom. Klorad enforces it — a restricted file gets a link that expires."],
            ["Translations", "What is missing a translation, per language."],
            ["How it was made", "Who scanned it, with what, and when. Researchers ask; most visitors never will."],
            ["Visitors", "How many people looked, and from where. No cookies, no tracking, nothing to consent to."],
          ].map(([term, def]) => (
            <div key={term} className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-text-primary">{term}</dt>
              <dd className="flex-1 text-text-secondary">{def}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
