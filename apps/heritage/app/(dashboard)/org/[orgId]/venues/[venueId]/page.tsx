import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Building2,
  ExternalLink,
  Layers,
  Route,
  ScanLine,
  ShieldCheck,
  Target,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Venue" };

/**
 * Venue overview.
 *
 * Deliberately a status surface rather than an editor: this arc ships the
 * data model and the shell, not the curator console (§7.2, Phase 1). What it
 * does show is the two things the spec says get underestimated and then sink
 * the delivery — untranslated content and proxies invalidated by a recapture
 * (§13.3) — because a number on the overview is how they stop being
 * invisible.
 */
export default async function VenueOverviewPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    include: {
      project: { select: { isPublished: true } },
      _count: {
        select: {
          spaces: true,
          scenes: true,
          objects: true,
          representations: true,
          proxies: true,
          tours: true,
        },
      },
    },
  });
  if (!venue) notFound();

  const [staleProxies, unclearedRepresentations, pendingIngest] =
    await Promise.all([
      prisma.heritageProxy.count({
        where: { venueId, invalidatedAt: { not: null } },
      }),
      // Modelling rule 2 in practice: a representation with no rights of its
      // own falls back to the object's, and an object with none resolves to
      // "Copyright Not Evaluated" — which is not a publishable state.
      prisma.heritageRepresentation.count({
        where: { venueId, rights: null, object: { rights: null } },
      }),
      prisma.heritageRepresentation.count({
        where: { venueId, status: { in: ["pending", "queued", "processing"] } },
      }),
    ]);

  const name = pickLocalized(venue.name, venue.defaultLanguage, "en") ?? "Venue";
  const base = `/org/${orgId}/venues/${venueId}`;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {venue.project.isPublished ? "Published" : "Draft"}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            {name}
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            {venue.languages.length}{" "}
            {venue.languages.length === 1 ? "language" : "languages"} ·{" "}
            <span className="font-mono text-xs">/v/{venue.slug}</span>
          </p>
        </div>
        <Link
          href={`/v/${venue.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
        >
          <ExternalLink size={14} strokeWidth={1.8} aria-hidden />
          View public page
        </Link>
      </header>

      {(staleProxies > 0 || unclearedRepresentations > 0) && (
        <section className="mb-8 space-y-3">
          {staleProxies > 0 && (
            <Attention
              href={`${base}/proxies`}
              title={`${staleProxies} ${staleProxies === 1 ? "proxy needs" : "proxies need"} re-checking`}
              body="A scene was recaptured after these were placed. A proxy authored against geometry that has since moved points at the wrong thing, which is worse than a missing one."
            />
          )}
          {unclearedRepresentations > 0 && (
            <Attention
              href={`${base}/rights`}
              title={`${unclearedRepresentations} ${unclearedRepresentations === 1 ? "capture has" : "captures have"} no rights statement`}
              body="Neither the capture nor the object it depicts carries one, so these resolve to Copyright Not Evaluated and cannot be aggregated."
            />
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          icon={Boxes}
          label="Objects"
          value={venue._count.objects}
          hint="Physical originals"
          href={`${base}/objects`}
        />
        <Stat
          icon={ScanLine}
          label="Representations"
          value={venue._count.representations}
          hint={
            pendingIngest > 0
              ? `${pendingIngest} still processing`
              : "Captures of objects and spaces"
          }
          href={`${base}/representations`}
        />
        <Stat
          icon={Building2}
          label="Spaces"
          value={venue._count.spaces}
          hint="Galleries, sectors, scanned scenes"
          href={`${base}/spaces`}
        />
        <Stat
          icon={Layers}
          label="Scenes"
          value={venue._count.scenes}
          hint="Renderable units"
          href={`${base}/scenes`}
        />
        <Stat
          icon={Target}
          label="Proxies"
          value={venue._count.proxies}
          hint="What a visitor can actually tap"
          href={`${base}/proxies`}
        />
        <Stat
          icon={Route}
          label="Tours"
          value={venue._count.tours}
          hint="Screen and headset, one definition"
          href={`${base}/tours`}
        />
      </section>

      <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-text-tertiary">
        <ShieldCheck size={14} strokeWidth={1.7} aria-hidden className="mt-px shrink-0" />
        <span>
          This venue holds the record, not just the experience. Rights resolve
          to the more restrictive of the object&rsquo;s and the
          capture&rsquo;s, and paradata stays attached to the capture rather
          than to what it depicts.
        </span>
      </p>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line-soft bg-bg p-5 transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        <Icon size={11} strokeWidth={1.8} aria-hidden />
        {label}
      </div>
      <div className="mt-2 text-3xl font-light text-text-primary transition-colors group-hover:text-accent">
        {value.toLocaleString()}
      </div>
      <p className="mt-1 text-xs text-text-tertiary">{hint}</p>
    </Link>
  );
}

function Attention({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 transition-colors hover:border-amber-500/60"
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.7}
        aria-hidden
        className="mt-0.5 shrink-0 text-amber-600"
      />
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{body}</p>
      </div>
    </Link>
  );
}
