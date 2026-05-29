import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickLocalized } from "@/app/lib/i18n-core";
import { listTopClubsForProject } from "@/lib/clubs-db";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { SegmentedTabs } from "@/lib/consumer/SegmentedTabs";
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

const AVATAR_BG: Record<string, string> = {
  purple: "var(--brand-primary-fill)",
  coral: "var(--brand-accent-warm)",
  teal: "var(--brand-accent-cool)",
  pink: "var(--brand-accent-complement)",
};

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
    title: `Clubs · ${name}`,
    description: `Student clubs and societies at ${name}.`,
  };
}

/**
 * `/campus/[token]/clubs` — public clubs list.
 *
 * Larger than the home's rail — every club on campus, ranked by
 * activity. Each card links to its detail page; the View pill opens
 * the club's external link (Discord / Insta / …) in a new tab.
 */
export default async function ClubsPage({
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
  const clubs = await listTopClubsForProject(map.id, 50);

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
          Explore
        </h1>
        <SegmentedTabs
          token={token}
          lang={lang}
          locale={locale}
          active="clubs"
        />
        <p className="mt-4 text-sm text-[var(--brand-text-muted)]">
          Student societies, sport clubs, interest groups — ranked by
          activity.
        </p>

        {clubs.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
            No clubs published yet.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c) => {
              const name = pickLocalized(c.name, c.nameEl, locale);
              const description = pickLocalized(
                c.description,
                c.descriptionEl,
                locale,
              );
              return (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--brand-line)] bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: AVATAR_BG[c.avatarColor] }}
                    >
                      {c.initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/campus/${token}/clubs/${c.id}${lang}`}
                      className="block truncate text-base font-medium text-[var(--brand-text)] transition-colors hover:text-[var(--brand-primary)]"
                    >
                      {name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-[var(--brand-text-muted)]">
                      {c.memberCount} members
                      {c.meetsCadence ? ` · ${c.meetsCadence}` : ""}
                    </p>
                  </div>
                </div>

                <p className="line-clamp-3 text-sm leading-relaxed text-[var(--brand-text)]">
                  {description}
                </p>

                {c.anchors[0] ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]">
                    <MapPin size={12} strokeWidth={1.75} />
                    {c.anchors[0].refName}
                  </span>
                ) : null}

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Link
                    href={`/campus/${token}/clubs/${c.id}${lang}`}
                    className="rounded-full border border-[var(--brand-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
                  >
                    Details
                  </Link>
                  {c.externalLink ? (
                    <a
                      href={c.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    >
                      <ExternalLink size={12} strokeWidth={1.75} />
                      View
                    </a>
                  ) : null}
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
