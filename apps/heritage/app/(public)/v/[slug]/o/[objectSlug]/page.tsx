import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/heritage/i18n";
import { RIGHTS_LABEL, RIGHTS_URI, applyScanPolicy } from "@/lib/heritage/rights";
import { deliveryUrlFor } from "@/lib/heritage/delivery";
import { ViewerCanvas } from "@/lib/heritage/ui/ViewerCanvas";

type Params = Promise<{ slug: string; objectSlug: string }>;
type Search = Promise<{ lang?: string }>;

/**
 * HER-102 — the artifact viewer.
 *
 * A single object: orbit, zoom to close range, and the record beside it —
 * description, dating, provenance, rights, and a visible link to the source
 * record. §7.1.2 also makes this the component published at the oEmbed
 * endpoint, so it has to stand alone in an iframe on someone else's site: no
 * auth, no tenant chrome, nothing that assumes it owns the page.
 *
 * The record renders server-side and is complete without the canvas. That is
 * the non-spatial equivalent §10.1 requires, and it is also why the page is
 * useful before the geometry finishes downloading.
 */
async function load(slug: string, objectSlug: string) {
  return prisma.heritageObject.findFirst({
    where: {
      slug: objectSlug,
      state: "published",
      venue: { slug, project: { isPublished: true } },
    },
    include: {
      venue: {
        select: {
          slug: true,
          name: true,
          languages: true,
          defaultLanguage: true,
          scanOfPublicDomainAssertsRights: true,
        },
      },
      period: true,
      space: { select: { name: true } },
      representations: {
        where: { state: "published", kind: { in: ["mesh", "panorama"] } },
        include: { files: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, objectSlug } = await params;
  const o = await load(slug, objectSlug);
  if (!o) return { title: "Not found" };
  const lang = o.venue.defaultLanguage;
  const canonical = `/v/${o.venue.slug}/o/${o.slug}`;
  return {
    title: pickLocalized(o.title, lang, "en") ?? "Object",
    description: pickLocalized(o.description, lang, "en") ?? undefined,
    alternates: {
      canonical,
      // oEmbed discovery. A consumer that has only the page URL finds the
      // provider endpoint through this link — it is half of what "a working
      // oEmbed discovery endpoint" in §7.4.2 actually means, and the half
      // that is easy to forget because the endpoint works without it.
      types: {
        "application/json+oembed": `/api/oembed?url=${encodeURIComponent(canonical)}&format=json`,
      },
    },
  };
}

export default async function ArtifactViewerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, objectSlug } = await params;
  const { lang } = await searchParams;
  const o = await load(slug, objectSlug);
  if (!o) notFound();

  const language = lang ?? o.venue.defaultLanguage;
  const t = (v: unknown) => pickLocalized(v, language, o.venue.defaultLanguage);

  // Only representations that actually have a delivery file can be rendered.
  // A capture still queued for processing has a record but no geometry.
  const candidates = o.representations
    .flatMap((r) =>
      r.files
        .filter((f) => f.purpose === "delivery")
        .slice(0, 1)
        .map((f) => ({ representation: r, file: f })),
    )
    .slice(0, 1);

  // Signed per request against private storage, with a lifetime set by the
  // rights that actually apply to this object.
  const layers = (
    await Promise.all(
      candidates.map(async (c) => {
        const url = await deliveryUrlFor(c.file, {
          objectRights: o.rights,
          representationRights: c.representation.rights,
          scanAssertsRights: o.venue.scanOfPublicDomainAssertsRights,
        });
        return url ? { id: c.representation.id, url } : null;
      }),
    )
  ).filter((l): l is { id: string; url: string } => l !== null);

  const primary = o.representations[0];
  const resolvedRights = primary
    ? applyScanPolicy(
        o.rights,
        primary.rights,
        o.venue.scanOfPublicDomainAssertsRights,
      )
    : o.rights;

  const title = t(o.title) ?? o.slug;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 md:px-10">
      <Link
        href={`/v/${o.venue.slug}${lang ? `?lang=${lang}` : ""}`}
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={13} strokeWidth={1.8} aria-hidden />
        {t(o.venue.name) ?? "Back"}
      </Link>

      <h1 className="mt-4 text-3xl font-light leading-[1.1] text-text-primary md:text-4xl">
        {title}
      </h1>
      {o.identifier ? (
        <p className="mt-1 font-mono text-xs text-text-tertiary">{o.identifier}</p>
      ) : null}

      {layers.length > 0 ? (
        <ViewerCanvas className="mt-6" layers={layers} height={420} />
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
          No 3D model has been published for this object yet.
        </p>
      )}

      {t(o.description) ? (
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-text-secondary">
          {t(o.description)}
        </p>
      ) : null}

      <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {o.objectType ? <Row label="Object type" value={o.objectType} /> : null}
        {o.materials.length > 0 ? (
          <Row label="Materials" value={o.materials.join(", ")} />
        ) : null}
        {o.period ? (
          <Row
            label="Period"
            value={
              [
                t(o.period.name),
                o.period.startYear !== null && o.period.endYear !== null
                  ? `${formatYear(o.period.startYear)} – ${formatYear(o.period.endYear)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            }
          />
        ) : null}
        {o.space ? <Row label="On display in" value={t(o.space.name) ?? "—"} /> : null}
        {t(o.creditLine) ? <Row label="Credit" value={t(o.creditLine)!} /> : null}
        {resolvedRights ? (
          <Row
            label="Rights"
            value={RIGHTS_LABEL[resolvedRights]}
            href={RIGHTS_URI[resolvedRights]}
          />
        ) : null}
      </dl>

      {o.externalUri ? (
        <a
          href={o.externalUri}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          View the source record
          <ExternalLink size={13} strokeWidth={1.8} aria-hidden />
        </a>
      ) : null}

      {o.venue.languages.length > 1 ? (
        <nav aria-label="Language" className="mt-10 flex flex-wrap items-center gap-2">
          {o.venue.languages.map((tag) => (
            <a
              key={tag}
              href={`/v/${o.venue.slug}/o/${o.slug}?lang=${tag}`}
              aria-current={tag === language ? "true" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tag === language
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              {tag}
            </a>
          ))}
        </nav>
      ) : null}
    </main>
  );
}

/** Astronomical year numbering: 0 is 1 BCE, -1 is 2 BCE. */
function formatYear(y: number): string {
  return y > 0 ? `${y} CE` : `${Math.abs(y - 1)} BCE`;
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text-primary">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="hover:text-accent">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
