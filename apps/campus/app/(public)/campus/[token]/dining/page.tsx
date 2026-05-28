import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickLocalized } from "@/app/lib/i18n-core";
import { listDiningForProject } from "@/lib/dining-db";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  const scene = (map?.sceneData ?? null) as {
    branding?: { name?: string };
  } | null;
  const name = scene?.branding?.name || map?.title || "Campus";
  return {
    title: `Dining · ${name}`,
    description: `Where to eat on the ${name} campus — cafes, cafeterias, hours.`,
  };
}

/**
 * `/campus/[token]/dining` — public dining list.
 *
 * Arc 5 of [[campus-consumer-pivot]]. A single page that holds the
 * whole list — no per-location detail page (each row is small
 * enough). Cards grid: 2 columns at md+, 1 on mobile.
 */
export default async function DiningPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();

  const scene = (map.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const campusName = branding.name || map.title;
  const accentColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  const themeStyle = accentColor
    ? ({ ["--brand-primary" as string]: accentColor } as React.CSSProperties)
    : undefined;

  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  const locations = await listDiningForProject(map.id);

  return (
    <main data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
        <h1 className="text-3xl font-medium text-[var(--brand-text)]">
          Dining
        </h1>
        <p className="mt-2 text-sm text-[var(--brand-text-muted)]">
          Where to eat on campus.
        </p>

        {locations.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
            No dining published yet.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            {locations.map((l) => {
              const firstAnchor = l.anchors[0];
              const name = pickLocalized(l.name, l.nameEl, locale);
              const description = pickLocalized(
                l.description,
                l.descriptionEl,
                locale,
              );
              return (
                <article
                  key={l.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white"
                >
                  {l.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.imageUrl}
                      alt=""
                      className="block aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="aspect-[16/9] w-full"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--brand-primary-bg) 0%, #E0F2EE 100%)",
                      }}
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h2 className="text-lg font-medium text-[var(--brand-text)]">
                        {name}
                      </h2>
                      {l.cuisine ? (
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">
                          {l.cuisine}
                        </p>
                      ) : null}
                    </div>

                    <p className="text-sm leading-relaxed text-[var(--brand-text)]">
                      {description}
                    </p>

                    {l.hoursText ? (
                      <p className="inline-flex items-center gap-1.5 text-xs text-[var(--brand-text-muted)]">
                        <Clock size={14} strokeWidth={1.75} />
                        {l.hoursText}
                      </p>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      {firstAnchor ? (
                        firstAnchor.refId ? (
                          <Link
                            href={`${mapHref}&space=${encodeURIComponent(firstAnchor.refId)}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
                          >
                            <MapPin size={14} strokeWidth={1.75} />
                            {firstAnchor.refName}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]">
                            <MapPin size={14} strokeWidth={1.75} />
                            {firstAnchor.refName}
                          </span>
                        )
                      ) : null}
                      {l.menuUrl ? (
                        <a
                          href={l.menuUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
                        >
                          <ExternalLink size={14} strokeWidth={1.75} />
                          View menu
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
