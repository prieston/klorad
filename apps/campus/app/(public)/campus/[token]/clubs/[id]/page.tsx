import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickLocalized } from "@/app/lib/i18n-core";
import { getClub } from "@/lib/clubs-db";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";

type Params = Promise<{ token: string; id: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

const AVATAR_HEX: Record<string, string> = {
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
  const { token, id } = await params;
  const [map, club] = await Promise.all([
    getPublicCampusByToken(token),
    getClub(id),
  ]);
  if (!club || !map || club.projectId !== map.id) return { title: "Club" };
  return {
    title: `${club.name} · Clubs`,
    description: club.description.slice(0, 160),
  };
}

/**
 * `/campus/[token]/clubs/[id]` — public club detail.
 *
 * Avatar + name + meta (members, cadence), description, anchor
 * chips (deep-link to map), View button → external link in a new
 * tab. No identity, no tracking — see [[campus-consumer-pivot]].
 */
export default async function ClubDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, id } = await params;
  const sp = await searchParams;
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();
  const club = await getClub(id);
  if (!club || club.projectId !== map.id) notFound();

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
  const avatarBg = AVATAR_HEX[club.avatarColor] ?? AVATAR_HEX.purple;
  const name = pickLocalized(club.name, club.nameEl, locale);
  const description = pickLocalized(
    club.description,
    club.descriptionEl,
    locale,
  );

  return (
    <main id="main" data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <article className="mx-auto max-w-[760px] px-4 py-8 md:px-6 md:py-12">
        <Link
          href={`/campus/${token}${lang}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--brand-text-muted)] transition-colors hover:text-[var(--brand-primary)]"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Back to {campusName}
        </Link>

        <div className="mt-6 flex items-center gap-4">
          {club.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.imageUrl}
              alt={name}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-medium text-white"
              style={{ backgroundColor: avatarBg }}
            >
              {club.initials}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-medium text-[var(--brand-text)] md:text-3xl">
              {name}
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-text-muted)]">
              {club.memberCount} members
              {club.meetsCadence ? ` · ${club.meetsCadence}` : ""}
            </p>
          </div>
        </div>

        {club.anchors.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {club.anchors.map((a, i) =>
              a.refId ? (
                <Link
                  key={`${a.refId}-${i}`}
                  href={`${mapHref}&space=${encodeURIComponent(a.refId)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
                >
                  <MapPin size={14} strokeWidth={1.75} />
                  {a.refName}
                </Link>
              ) : (
                <span
                  key={`${a.refName}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
                >
                  <MapPin size={14} strokeWidth={1.75} />
                  {a.refName}
                </span>
              ),
            )}
          </div>
        ) : null}

        <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-[var(--brand-text)]">
          {description}
        </div>

        {club.externalLink ? (
          <div className="mt-8">
            <a
              href={club.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <ExternalLink size={16} strokeWidth={1.75} />
              View on {new URL(club.externalLink).hostname.replace(/^www\./, "")}
            </a>
          </div>
        ) : null}
      </article>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
