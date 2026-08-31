import { notFound } from "next/navigation";
import Link from "next/link";
import { Languages as LanguagesIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { missingLanguages, pickLocalized } from "@/lib/heritage/i18n";
import { PageHeader } from "@/lib/heritage/ui/page-header";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Languages" };

/**
 * HER-210 — translation coverage.
 *
 * Not the AI drafting workflow itself, which is inherited from Campus and
 * arrives with the assistant. What this answers is the question that has to be
 * answerable before any of that matters: which records are not translated, in
 * which languages. §7.2.10 requires human approval per language before
 * publication, and you cannot approve what you cannot see is missing.
 */
export default async function LanguagesPage({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { languages: true, defaultLanguage: true },
  });
  if (!venue) notFound();

  const [objects, scenes, tours, spaces] = await Promise.all([
    prisma.heritageObject.findMany({
      where: { venueId },
      select: { id: true, slug: true, title: true, description: true, state: true },
    }),
    prisma.heritageScene.findMany({
      where: { venueId },
      select: { id: true, slug: true, title: true, description: true, state: true },
    }),
    prisma.heritageTour.findMany({
      where: { venueId },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        state: true,
        stops: { select: { id: true, title: true, body: true } },
      },
    }),
    prisma.heritageSpace.findMany({
      where: { venueId },
      select: { id: true, slug: true, name: true, description: true, state: true },
    }),
  ]);

  const langs = venue.languages;
  const base = `/org/${orgId}/venues/${venueId}`;

  type Gap = { label: string; missing: string[]; href: string; state: string };
  const gaps: Gap[] = [];

  const add = (
    label: string,
    fields: unknown[],
    href: string,
    state: string,
  ) => {
    const missing = [
      ...new Set(fields.flatMap((f) => missingLanguages(f, langs))),
    ].sort();
    if (missing.length > 0) gaps.push({ label, missing, href, state });
  };

  for (const s of spaces) {
    add(
      `Space · ${pickLocalized(s.name, venue.defaultLanguage) ?? s.slug}`,
      [s.name, s.description],
      `${base}/spaces`,
      s.state,
    );
  }
  for (const o of objects) {
    add(
      `Object · ${pickLocalized(o.title, venue.defaultLanguage) ?? o.slug}`,
      [o.title, o.description],
      `${base}/objects`,
      o.state,
    );
  }
  for (const s of scenes) {
    add(
      `Scene · ${pickLocalized(s.title, venue.defaultLanguage) ?? s.slug}`,
      [s.title, s.description],
      `${base}/scenes`,
      s.state,
    );
  }
  for (const t of tours) {
    add(
      `Tour · ${pickLocalized(t.title, venue.defaultLanguage) ?? t.slug}`,
      [t.title, t.description, ...t.stops.flatMap((st) => [st.title, st.body])],
      `${base}/tours`,
      t.state,
    );
  }

  const total = spaces.length + objects.length + scenes.length + tours.length;
  const complete = total - gaps.length;
  // Published records with gaps are the urgent ones: a visitor is already
  // seeing a fallback language on those.
  const publishedGaps = gaps.filter((g) => g.state === "published");

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="Languages."
        lede={`This venue publishes in ${langs.join(", ")}. Untranslated fields fall back to ${venue.defaultLanguage} rather than rendering blank — which means a visitor sees the wrong language instead of nothing, and nobody notices unless it is counted.`}
      />

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Records" value={total} hint="Spaces, objects, scenes, tours" />
        <Stat label="Fully translated" value={complete} hint="Every venue language populated" />
        <Stat
          label="Published with gaps"
          value={publishedGaps.length}
          hint="Visitors are seeing a fallback"
          tone={publishedGaps.length > 0 ? "warn" : "ok"}
        />
      </section>

      {gaps.length === 0 ? (
        <div className="rounded-2xl border border-line-soft bg-bg p-10 text-center">
          <LanguagesIcon
            size={26}
            strokeWidth={1.6}
            aria-hidden
            className="mx-auto text-accent"
          />
          <p className="mt-4 text-sm text-text-primary">
            {total === 0
              ? "No content yet."
              : "Everything is translated into every language."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {gaps.map((g, i) => (
            <li key={`${g.href}-${i}`} className="flex flex-wrap items-center gap-3 py-3">
              <Link
                href={g.href}
                className="min-w-0 flex-1 truncate text-sm text-text-primary hover:text-accent"
              >
                {g.label}
              </Link>
              {g.state === "published" ? (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-700">
                  live
                </span>
              ) : null}
              <span className="flex shrink-0 flex-wrap gap-1">
                {g.missing.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-tertiary"
                  >
                    {m}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-xs leading-relaxed text-text-tertiary">
        AI-assisted drafting and translation, with human approval before
        publication and never automatic, is inherited from Campus and arrives
        with the assistant. This page is the part that has to exist first —
        knowing what is missing.
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-light ${
          tone === "warn" && value > 0 ? "text-amber-600" : "text-text-primary"
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-text-tertiary">{hint}</p>
    </div>
  );
}
