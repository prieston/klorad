import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/heritage/i18n";
import { RIGHTS_LABEL, RIGHTS_URI, applyScanPolicy } from "@/lib/heritage/rights";
import { EmbedFrame } from "@/lib/heritage/ui/EmbedFrame";

type Params = Promise<{ slug: string; objectSlug: string }>;
type Search = Promise<{ lang?: string }>;

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Embeddable artifact viewer.
 *
 * The same component §7.1.2 describes, stripped to what belongs inside someone
 * else's page: the model, the title, the rights statement, and a link back to
 * the canonical record. The rights line is not decoration — an embed that
 * travels without its statement is exactly the failure the closed list of 14
 * URIs exists to prevent.
 */
export default async function EmbedObjectPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, objectSlug } = await params;
  const { lang } = await searchParams;

  const object = await prisma.heritageObject.findFirst({
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
          defaultLanguage: true,
          scanOfPublicDomainAssertsRights: true,
        },
      },
      representations: {
        where: { state: "published", kind: { in: ["mesh", "panorama"] } },
        include: { files: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!object) notFound();

  const language = lang ?? object.venue.defaultLanguage;
  const t = (v: unknown) =>
    pickLocalized(v, language, object.venue.defaultLanguage);

  const layers = object.representations
    .flatMap((r) =>
      r.files
        .filter((f) => f.url && (f.purpose === "delivery" || f.purpose === "master"))
        .slice(0, 1)
        .map((f) => ({ id: r.id, url: f.url as string })),
    )
    .slice(0, 1);

  const primary = object.representations[0];
  const rights = primary
    ? applyScanPolicy(
        object.rights,
        primary.rights,
        object.venue.scanOfPublicDomainAssertsRights,
      )
    : object.rights;

  return (
    <EmbedFrame
      title={t(object.title) ?? object.slug}
      subtitle={t(object.venue.name) ?? null}
      canonicalPath={`/v/${object.venue.slug}/o/${object.slug}`}
      rightsLabel={rights ? RIGHTS_LABEL[rights] : null}
      rightsUri={rights ? RIGHTS_URI[rights] : null}
      layers={layers}
    />
  );
}
