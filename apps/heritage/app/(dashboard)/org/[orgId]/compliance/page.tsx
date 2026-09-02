import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, FileCheck2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pickLocalized, isFullyTranslated } from "@/lib/heritage/i18n";
import { RIGHTS_LABEL } from "@/lib/heritage/rights";
import { PageHeader } from "@/lib/heritage/ui/page-header";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Compliance" };

/**
 * HER-501 — the reporting screen a ministry buys.
 *
 * Commission Recommendation 2021/1970 has Member States report every two years
 * on what has been digitised, in 3D, to standard, with rights cleared, and
 * published onward. An institution asked for those figures currently produces
 * them by hand from a spreadsheet, badly and late.
 *
 * Everything here is derived — no counters, no nightly job, no table that can
 * drift from the records it summarises. A figure on this page is a query over
 * the same rows the curator edits, which is the only way a number stays true
 * after someone changes their mind about an object at four in the afternoon.
 *
 * The blocked column is the one that earns the page. A count of what is done
 * is a report; a list of what is stopping the rest is a work queue.
 */
export default async function CompliancePage({ params }: { params: Params }) {
  const { orgId } = await params;

  const session = await auth();
  if (!session?.user?.id) notFound();

  // Scoped through the membership, not through the org id in the URL.
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
      languages: true,
      scanOfPublicDomainAssertsRights: true,
      project: { select: { isPublished: true } },
      objects: {
        select: {
          id: true,
          title: true,
          state: true,
          rights: true,
          representations: {
            select: { id: true, kind: true, state: true, rights: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = venues.map((venue) => {
    const objects = venue.objects;

    // "Digitised in 3D" means a mesh or splat capture exists at all — not that
    // it is published. The Recommendation counts the digitisation, and an
    // institution that has captured an object but not yet cleared it has still
    // done the expensive part.
    const with3d = objects.filter((o) =>
      o.representations.some((r) => r.kind === "mesh" || r.kind === "splat"),
    );
    const deliverable = objects.filter((o) =>
      o.representations.some((r) => r.status === "ready"),
    );

    // Rights are cleared when the resolved statement is something other than
    // the default. An unset statement resolves to in-copyright, which is the
    // safe answer and is *not* a decision anybody made.
    const rightsCleared = objects.filter((o) => {
      const primary = o.representations[0];
      if (!o.rights && !primary?.rights) return false;
      return true;
    });

    const translated = objects.filter((o) =>
      isFullyTranslated(o.title, venue.languages),
    );
    const published = objects.filter((o) => o.state === "published");

    // What is stopping the rest, in the order a curator would fix it.
    const blockers: { label: string; count: number; href: string }[] = [
      {
        label: "no rights statement",
        count: objects.length - rightsCleared.length,
        href: `/org/${orgId}/venues/${venue.id}/rights`,
      },
      {
        label: "no 3D capture",
        count: objects.length - with3d.length,
        href: `/org/${orgId}/venues/${venue.id}/files`,
      },
      {
        label: "capture not processed",
        count: with3d.length - deliverable.length,
        href: `/org/${orgId}/venues/${venue.id}/files`,
      },
      {
        label: "missing a translation",
        count: objects.length - translated.length,
        href: `/org/${orgId}/venues/${venue.id}/languages`,
      },
      {
        label: "still a draft",
        count: objects.length - published.length,
        href: `/org/${orgId}/venues/${venue.id}/items`,
      },
    ].filter((b) => b.count > 0);

    return {
      venue,
      total: objects.length,
      with3d: with3d.length,
      deliverable: deliverable.length,
      rightsCleared: rightsCleared.length,
      translated: translated.length,
      published: published.length,
      blockers,
      unevaluated: objects
        .filter((o) => {
          const primary = o.representations[0];
          return !o.rights && !primary?.rights;
        })
        .slice(0, 5),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      with3d: acc.with3d + r.with3d,
      rightsCleared: acc.rightsCleared + r.rightsCleared,
      published: acc.published + r.published,
    }),
    { total: 0, with3d: 0, rightsCleared: 0, published: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        eyebrow="HER-501"
        title="Compliance."
        lede="What has been digitised, captured in 3D, rights-cleared and published — across every venue in this organisation. Derived live from the records themselves, so a figure here cannot be stale."
      />

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
          No venues yet.
        </p>
      ) : (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-4">
            <Stat label="Objects" value={totals.total} of={null} />
            <Stat label="Captured in 3D" value={totals.with3d} of={totals.total} />
            <Stat label="Rights cleared" value={totals.rightsCleared} of={totals.total} />
            <Stat label="Published" value={totals.published} of={totals.total} />
          </section>

          <div className="space-y-6">
            {rows.map((r) => (
              <section
                key={r.venue.id}
                className="rounded-2xl border border-line-soft bg-bg p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium text-text-primary">
                    {pickLocalized(r.venue.name, r.venue.defaultLanguage, "en") ??
                      r.venue.slug}
                    {!r.venue.project.isPublished ? (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                        unpublished
                      </span>
                    ) : null}
                  </h2>
                  <Link
                    href={`/org/${orgId}/venues/${r.venue.id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    Open venue
                  </Link>
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-5">
                  <Measure label="Objects" value={r.total} of={null} />
                  <Measure label="3D" value={r.with3d} of={r.total} />
                  <Measure label="Viewable" value={r.deliverable} of={r.total} />
                  <Measure label="Rights" value={r.rightsCleared} of={r.total} />
                  <Measure label="Published" value={r.published} of={r.total} />
                </dl>

                {r.blockers.length > 0 ? (
                  <div className="mt-5 border-t border-line-soft pt-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
                      What is holding the rest back
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {r.blockers.map((b) => (
                        <li key={b.label}>
                          <Link
                            href={b.href}
                            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-text-secondary transition hover:text-text-primary"
                          >
                            <span className="font-medium tabular-nums text-text-primary">
                              {b.count}
                            </span>
                            {b.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-5 border-t border-line-soft pt-4 text-xs text-emerald-600">
                    Every object is captured, cleared, translated and published.
                  </p>
                )}

                {r.unevaluated.length > 0 ? (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle
                      size={12}
                      strokeWidth={1.8}
                      aria-hidden
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      {r.unevaluated.length === 1 ? "One object has" : "Objects have"} no
                      rights statement on either the original or the capture, so
                      they resolve to{" "}
                      <strong className="font-medium">{RIGHTS_LABEL.cne}</strong> and
                      cannot be sent to an aggregator. That is the safe default,
                      not a decision anyone made.
                    </span>
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </>
      )}

      <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-text-tertiary">
        <FileCheck2 size={13} strokeWidth={1.7} aria-hidden className="mt-px shrink-0" />
        <span>
          These are the categories Commission Recommendation 2021/1970 has
          Member States report on. Nothing here is cached: every figure is a
          query over the records a curator edits, so it cannot drift from what
          is actually in the collection.
        </span>
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of: number | null;
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-5">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-3xl font-light text-text-primary">
        {value.toLocaleString()}
      </p>
      {of && of > 0 ? (
        <p className="mt-1 text-xs text-text-tertiary">
          {Math.round((value / of) * 100)}% of {of.toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function Measure({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of: number | null;
}) {
  const pct = of && of > 0 ? Math.round((value / of) * 100) : null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.2em] text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-light tabular-nums text-text-primary">
        {value.toLocaleString()}
        {pct !== null ? (
          <span className="ml-1.5 text-xs text-text-tertiary">{pct}%</span>
        ) : null}
      </dd>
      {pct !== null ? (
        <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
