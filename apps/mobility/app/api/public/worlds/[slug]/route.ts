/**
 * `GET /api/public/worlds/[slug]` — public world payload.
 *
 * Backs the service worker's stale-while-revalidate strategy so a
 * world that's been visited once is fully usable offline. Shape
 * matches what `WorldViewer` consumes via SSR; on subsequent visits
 * the client could swap to a SWR poll against this endpoint for live
 * updates without re-rendering the whole page. Returns 404 for
 * drafts / `authenticated` worlds so an enumeration attack can't
 * tell which slugs exist.
 */
import { NextResponse } from "next/server";
import { loadPublicWorldBySlug } from "@/lib/mobility/world-resolver";

type Params = Promise<{ slug: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { slug } = await params;
  const world = await loadPublicWorldBySlug(slug);
  if (!world) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      world: {
        slug: world.slug,
        name: world.name,
        description: world.description,
        visibility: world.visibility,
        theme: world.theme,
        devices: world.devices,
        styleIcons: world.styleIcons,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
