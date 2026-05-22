import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KloradMark } from "@klorad/design-system";
import { prisma } from "@/lib/prisma";
import { formatPostDate, readPosts } from "@/lib/posts";
import NotPublishedPlaceholder from "./NotPublishedPlaceholder";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Dynamic metadata so shared URLs preview nicely in Slack / WhatsApp / LinkedIn. */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const map = await prisma.project
    .findUnique({
      where: { id: token },
      select: { title: true, sceneData: true },
    })
    .catch(() => null);

  const scene = (map?.sceneData ?? null) as {
    branding?: { name?: string };
  } | null;
  const name = scene?.branding?.name || map?.title || "Campus";
  const description = `${name} — campus news, events, and an interactive 3D map with step-free indoor wayfinding.`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} · Klorad Campus`,
      description,
      type: "website",
      siteName: "Klorad Campus",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · Klorad Campus`,
      description,
    },
  };
}

/**
 * `/campus/[token]` — the public campus home page.
 *
 * The branded landing for a campus: news, and a route into the 3D
 * map (`/campus/[token]/map`). Server-rendered so news is in the
 * HTML for SEO and link previews.
 *
 * Gated on `isPublished`: unknown → 404, draft → "coming soon"
 * placeholder, published → the home.
 */
export default async function CampusHomePage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;

  const map = await prisma.project
    .findUnique({
      where: {
        id: token,
      },
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        sceneData: true,
      },
    })
    .catch(() => null);

  if (!map) notFound();
  if (!map.isPublished) return <NotPublishedPlaceholder name={map.title} />;

  const scene = (map.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const displayName = branding.name || map.title;
  const accent = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : "#158ca3";
  const posts = readPosts(map.sceneData);
  const mapHref = `/campus/${token}/map`;

  return (
    <main className="min-h-screen bg-bg">
      <header className="flex items-center justify-between gap-4 px-6 py-4 md:px-10">
        {branding.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo}
            alt={displayName}
            className="h-8 max-w-[200px] object-contain"
          />
        ) : (
          <span className="text-lg font-semibold text-text-primary">
            {displayName}
          </span>
        )}
        <Link
          href={mapHref}
          className="text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          Open map →
        </Link>
      </header>

      <section className="px-6 py-12 md:px-10 md:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          {displayName}
        </h1>
        {map.description ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary">
            {map.description}
          </p>
        ) : null}
        <Link
          href={mapHref}
          className="mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          Explore the campus map →
        </Link>
      </section>

      <section className="px-6 pb-20 md:px-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">
          News
        </h2>
        {posts.length > 0 ? (
          <div className="mt-4 space-y-4">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl bg-surface-1 p-6 shadow-glass"
              >
                <time className="text-xs text-text-tertiary">
                  {formatPostDate(post.publishedAt)}
                </time>
                <h3 className="mt-1 text-lg font-semibold text-text-primary">
                  {post.title}
                </h3>
                {post.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                    {post.body}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-tertiary">
            No news yet — check back soon.
          </p>
        )}
      </section>

      <footer className="border-t border-solid border-line-soft px-6 py-6 text-center md:px-10">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary">
          <KloradMark className="h-4 w-4" />
          Powered by Klorad
        </span>
      </footer>
    </main>
  );
}
