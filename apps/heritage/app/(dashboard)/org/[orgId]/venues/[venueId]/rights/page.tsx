import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Scale } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { PageHeader } from "@/lib/heritage/ui/page-header";
import {
  RIGHTS_LABEL,
  RIGHTS_URI,
  applyScanPolicy,
  permitsDirectFileAccess,
} from "@/lib/heritage/rights";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Rights" };

/**
 * HER-206 — rights, resolved.
 *
 * Rights are *set* on the object and on each capture, from their own pages.
 * What this page does is show the answer: what actually governs each capture
 * once the two are reconciled through the venue's public-domain-scan policy.
 * §10.2 restates this as a legal constraint rather than a feature — every
 * record delivered to an aggregator carries one of 14 permitted URIs, and
 * where the original and the representation differ, the more restrictive
 * applies.
 */
export default async function RightsPage({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: {
      defaultLanguage: true,
      scanOfPublicDomainAssertsRights: true,
      defaultRights: true,
    },
  });
  if (!venue) notFound();

  const representations = await prisma.heritageRepresentation.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    include: {
      object: { select: { id: true, slug: true, title: true, rights: true } },
      space: { select: { slug: true, name: true } },
    },
  });

  const lang = venue.defaultLanguage;
  const base = `/org/${orgId}/venues/${venueId}`;

  const rows = representations.map((r) => {
    const resolved = applyScanPolicy(
      r.object?.rights ?? null,
      r.rights,
      venue.scanOfPublicDomainAssertsRights,
    );
    return {
      id: r.id,
      label:
        pickLocalized(r.label, lang, "en") ??
        pickLocalized(r.object?.title, lang, "en") ??
        `${r.kind} capture`,
      kind: r.kind,
      attachedTo:
        pickLocalized(r.object?.title, lang, "en") ??
        pickLocalized(r.space?.name, lang, "en") ??
        null,
      objectRights: r.object?.rights ?? null,
      ownRights: r.rights,
      resolved,
      /** Neither side set anything — resolves to CNE and cannot be aggregated. */
      unevaluated: !r.object?.rights && !r.rights,
      downloadable: permitsDirectFileAccess(resolved),
    };
  });

  const unevaluated = rows.filter((r) => r.unevaluated);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="Rights."
        lede="Set on the page for each object and each capture. Resolved here — the more restrictive of the two always wins, so this is what an aggregator would actually receive."
      />

      <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-5">
        <p className="flex items-start gap-2 text-sm text-text-secondary">
          <Scale size={15} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <span>
            This venue treats a scan of a public-domain object as{" "}
            <strong className="font-medium text-text-primary">
              {venue.scanOfPublicDomainAssertsRights
                ? "asserting new rights"
                : "inheriting the original's status"}
            </strong>
            .{" "}
            {venue.scanOfPublicDomainAssertsRights
              ? "A capture may therefore be more restrictive than the object it depicts."
              : "A capture of a public-domain original cannot restrict it."}{" "}
            <Link href={`${base}/settings`} className="text-accent hover:underline">
              Change in settings
            </Link>
            .
          </span>
        </p>
      </section>

      {unevaluated.length > 0 && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
          <AlertTriangle
            size={18}
            strokeWidth={1.7}
            aria-hidden
            className="mt-0.5 shrink-0 text-amber-600"
          />
          <div className="text-sm">
            <p className="font-medium text-text-primary">
              {unevaluated.length}{" "}
              {unevaluated.length === 1 ? "capture has" : "captures have"} no
              rights statement on either side
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              These resolve to Copyright Not Evaluated. That is what the status
              means and it is the honest default, but a record carrying it
              cannot be aggregated and should not be published.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-tertiary">
          No captures yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                <th className="py-3 pr-4 font-medium">Capture</th>
                <th className="py-3 pr-4 font-medium">On the original</th>
                <th className="py-3 pr-4 font-medium">On the capture</th>
                <th className="py-3 pr-4 font-medium">Governs</th>
                <th className="py-3 font-medium">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 pr-4">
                    <span className="text-text-primary">{r.label}</span>
                    {r.attachedTo ? (
                      <span className="block text-xs text-text-tertiary">
                        {r.attachedTo}
                      </span>
                    ) : (
                      <span className="block text-xs text-amber-600">
                        not attached
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-text-secondary">
                    {r.objectRights ? RIGHTS_LABEL[r.objectRights] : "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs text-text-secondary">
                    {r.ownRights ? RIGHTS_LABEL[r.ownRights] : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        r.unevaluated
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-accent-soft text-accent"
                      }`}
                      title={RIGHTS_URI[r.resolved]}
                    >
                      {RIGHTS_LABEL[r.resolved]}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-text-tertiary">
                    {r.downloadable ? "downloadable" : "view only"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-10 text-xs leading-relaxed text-text-tertiary">
        “Downloadable” means the resolved statement permits offering the file
        itself, not just viewing it in the platform. An aggregator scores a
        higher content tier for a direct file URL, but only where the rights
        allow the file to be handed over at all.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-text-tertiary">
        This column is enforced, not advisory. Captures are stored privately and
        every delivery URL is signed and time-limited — around a day for the
        open statements, fifteen minutes for the rest. A link copied out of a
        “view only” page stops working; it does not become a permanent public
        address for someone else’s copyright.
      </p>
    </main>
  );
}
