import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KloradMark } from "@klorad/design-system";
import { prisma } from "@/lib/prisma";
import PublicViewerClient from "./PublicViewerClient";

type Params = Promise<{ token: string }>;

/** Dynamic metadata so shared URLs preview nicely in Slack / WhatsApp / LinkedIn. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const map = await prisma.project
    .findUnique({
      where: { id: token },
      select: { title: true, sceneData: true },
    })
    .catch(() => null);

  const scene = (map?.sceneData ?? null) as { branding?: { name?: string } } | null;
  const name = scene?.branding?.name || map?.title || "Campus Map";
  const description =
    `${name} — an interactive 3D campus map. Explore buildings, find rooms, and get step-free directions.`;

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
 * Public viewer entry point.
 *
 * Gates the campus on `isPublished`:
 *   - Map not found  → standard 404
 *   - Found but not published → branded "Coming soon" placeholder
 *   - Published      → mount the real client viewer
 *
 * Anonymous-only — the page doesn't try to detect an authenticated
 * owner. A future enhancement could let the owner preview their own
 * draft via a short-lived signed link; for now, drafts are private
 * until the author flips the switch.
 */
export default async function PublicViewerPage({ params }: { params: Params }) {
  const { token } = await params;

  const map = await prisma.project
    .findUnique({
      where: { id: token },
      select: { id: true, title: true, isPublished: true },
    })
    .catch(() => null);

  if (!map) notFound();

  if (!map.isPublished) {
    return <NotPublishedPlaceholder name={map.title} />;
  }

  return <PublicViewerClient mapId={token} />;
}

/**
 * Friendly "coming soon" placeholder for drafts. No internal data
 * leaked — visitor sees the campus name (already publicly known via
 * the URL share) and a generic note. Looks branded so the page
 * doesn't read as a 404.
 */
function NotPublishedPlaceholder({ name }: { name: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-16 text-center">
      <KloradMark className="h-10 w-10" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">
        {name}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-text-secondary">
        This campus isn&apos;t published yet. The author is still building
        it — check back soon.
      </p>
      <p className="mt-8 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary">
        Powered by Klorad
      </p>
    </main>
  );
}
