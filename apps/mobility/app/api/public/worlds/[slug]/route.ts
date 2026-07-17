/**
 * `GET /api/public/worlds/[slug]` — world payload for the SW's
 * stale-while-revalidate cache + potential SWR polling on the
 * client. Session-aware for `authenticated` worlds via
 * `loadWorldForPushViewer` — same helper the push endpoints use, so
 * a granted user's SW `fetch` (which forwards same-origin cookies)
 * receives the payload while anonymous probes still 404.
 *
 * Cache-Control varies by visibility:
 *   public / linkOnly → `public, s-maxage=60` (CDN-cacheable)
 *   authenticated     → `private, no-store` (per-user, never shared)
 */
import { NextResponse } from "next/server";
import { loadWorldForPushViewer } from "@/lib/mobility/world-resolver";

type Params = Promise<{ slug: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { slug } = await params;
  const world = await loadWorldForPushViewer(slug);
  if (!world) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const cacheControl =
    world.visibility === "authenticated"
      ? "private, no-store, max-age=0"
      : "public, max-age=60, s-maxage=60";
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
        styleModels: world.styleModels,
        customIcons: world.customIcons,
      },
    },
    { headers: { "Cache-Control": cacheControl } },
  );
}
