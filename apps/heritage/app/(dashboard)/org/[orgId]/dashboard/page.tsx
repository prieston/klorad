import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Boxes, Eye, Layers, ShieldAlert, UploadCloud } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pickLocalized } from "@/lib/heritage/i18n";
import { PageHeader } from "@/lib/heritage/ui/page-header";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Overview" };

/**
 * The organisation's front page.
 *
 * Not a summary of everything — a summary of what is *unfinished*. A dashboard
 * that reports how much work is done is read once and then ignored; one that
 * says which four objects have no rights statement gets opened on Monday
 * morning. Every number here is a link into the screen where it is fixed.
 */
export default async function OrgDashboard({ params }: { params: Params }) {
  const { orgId } = await params;

  const session = await auth();
  if (!session?.user?.id) notFound();

  const org = await prisma.organization.findFirst({
    where: { id: orgId, members: { some: { userId: session.user.id } } },
    select: { id: true, name: true },
  });
  if (!org) notFound();

  const venues = await prisma.heritageVenue.findMany({
    where: { project: { organizationId: org.id } },
    select: {
      id: true,
      slug: true,
      name: true,
      defaultLanguage: true,
      project: { select: { isPublished: true } },
      _count: {
        select: { objects: true, scenes: true, representations: true, tours: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const venueIds = venues.map((v) => v.id);

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);

  const [needsProcessing, failed, unevaluatedRights, views] = await Promise.all([
    prisma.heritageRepresentation.count({
      where: { venueId: { in: venueIds }, status: { in: ["queued", "processing"] } },
    }),
    prisma.heritageRepresentation.count({
      where: { venueId: { in: venueIds }, status: "failed" },
    }),
    // Neither the object nor any of its captures carries a statement, so the
    // whole thing resolves to in-copyright by default rather than by decision.
    prisma.heritageObject.count({
      where: {
        venueId: { in: venueIds },
        rights: null,
        representations: { none: { rights: { not: null } } },
      },
    }),
    prisma.heritageViewEvent.aggregate({
      where: { venueId: { in: venueIds }, day: { gte: since } },
      _sum: { count: true },
    }),
  ]);

  const totalViews = views._sum.count ?? 0;
  const attention = [
    {
      count: failed,
      label: failed === 1 ? "capture failed to process" : "captures failed to process",
      href: venues[0] ? `/org/${orgId}/venues/${venues[0].id}/files` : null,
      tone: "amber" as const,
      icon: UploadCloud,
    },
    {
      count: unevaluatedRights,
      label:
        unevaluatedRights === 1
          ? "object has no rights statement"
          : "objects have no rights statement",
      href: venues[0] ? `/org/${orgId}/venues/${venues[0].id}/rights` : null,
      tone: "amber" as const,
      icon: ShieldAlert,
    },
    {
      count: needsProcessing,
      label: needsProcessing === 1 ? "capture is processing" : "captures are processing",
      href: venues[0] ? `/org/${orgId}/venues/${venues[0].id}/files` : null,
      tone: "neutral" as const,
      icon: Layers,
    },
  ].filter((a) => a.count > 0);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title={`${org.name}.`}
        lede="What is unfinished, and where the collection is being seen."
      />

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <Tile
          icon={Eye}
          label="Views, last 30 days"
          value={totalViews.toLocaleString()}
          href={venues[0] ? `/org/${orgId}/venues/${venues[0].id}/analytics` : undefined}
        />
        <Tile
          icon={Boxes}
          label="Objects"
          value={venues.reduce((n, v) => n + v._count.objects, 0).toLocaleString()}
        />
        <Tile
          icon={Layers}
          label="Captures"
          value={venues
            .reduce((n, v) => n + v._count.representations, 0)
            .toLocaleString()}
        />
      </section>

      {attention.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            Needs attention
          </h2>
          <ul className="space-y-2">
            {attention.map((a) => {
              const Icon = a.icon;
              const body = (
                <span className="flex items-center gap-3">
                  <Icon
                    size={15}
                    strokeWidth={1.7}
                    aria-hidden
                    className={a.tone === "amber" ? "text-amber-600" : "text-text-tertiary"}
                  />
                  <span className="text-sm text-text-primary">
                    <strong className="font-medium tabular-nums">{a.count}</strong>{" "}
                    {a.label}
                  </span>
                </span>
              );
              return (
                <li key={a.label}>
                  {a.href ? (
                    <Link
                      href={a.href}
                      className="flex items-center justify-between rounded-2xl border border-line-soft bg-bg px-5 py-3.5 transition hover:border-line"
                    >
                      {body}
                      <ArrowRight size={14} strokeWidth={1.7} aria-hidden className="text-text-tertiary" />
                    </Link>
                  ) : (
                    <div className="rounded-2xl border border-line-soft bg-bg px-5 py-3.5">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : venues.length > 0 ? (
        <p className="mb-10 rounded-2xl border border-line-soft bg-bg p-5 text-sm text-emerald-600">
          Nothing is waiting. Every capture has processed and every object
          carries a rights statement.
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          Venues
        </h2>
        {venues.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
            No venues yet.{" "}
            <Link href={`/org/${orgId}`} className="text-accent hover:underline">
              Create the first one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {venues.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/org/${orgId}/venues/${v.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 transition hover:text-accent"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-text-primary">
                      {pickLocalized(v.name, v.defaultLanguage, "en") ?? v.slug}
                      {!v.project.isPublished ? (
                        <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                          unpublished
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[11px] text-text-tertiary">
                      {v._count.objects} objects · {v._count.scenes} scenes ·{" "}
                      {v._count.tours} tours
                    </span>
                  </span>
                  <ArrowRight size={14} strokeWidth={1.7} aria-hidden className="text-text-tertiary" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <Icon size={13} strokeWidth={1.7} aria-hidden />
        {label}
      </span>
      <span className="mt-2 block text-3xl font-light text-text-primary">{value}</span>
    </>
  );
  const className =
    "block rounded-2xl border border-line-soft bg-bg p-5 transition hover:border-line";
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
