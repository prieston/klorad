import type { Metadata } from "next";
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
      title: `${name} · Topos Campus`,
      description,
      type: "website",
      siteName: "Topos Campus",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · Topos Campus`,
      description,
    },
  };
}

export default async function PublicViewerPage({ params }: { params: Params }) {
  const { token } = await params;
  return <PublicViewerClient mapId={token} />;
}
