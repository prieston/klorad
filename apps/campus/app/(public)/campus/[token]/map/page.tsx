import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PublicViewerClient from "../PublicViewerClient";
import NotPublishedPlaceholder from "../NotPublishedPlaceholder";

type Params = Promise<{ token: string }>;

/**
 * `/campus/[token]/map` — the interactive 3D campus map.
 *
 * The map was the campus's entire public surface; Phase B moved it
 * here so `/campus/[token]` can be the branded home page. Same
 * `isPublished` gate as the home.
 */
export default async function CampusMapPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;

  const map = await prisma.project
    .findUnique({
      where: { id: token },
      select: { id: true, title: true, isPublished: true },
    })
    .catch(() => null);

  if (!map) notFound();
  if (!map.isPublished) return <NotPublishedPlaceholder name={map.title} />;

  return <PublicViewerClient mapId={token} />;
}
