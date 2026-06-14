/**
 * `GET /api/public/worlds/[slug]/vapid-public-key`
 *
 * Returns the VAPID public key the world's PWA needs to subscribe to
 * push. Anonymous endpoint — the key is safe to expose by design
 * (clients couldn't sign pushes without the private key). We still
 * tie it to a world resolver call so a draft / unknown slug 404s the
 * same way the manifest does, keeping the existence of unpublished
 * worlds hidden from probes.
 *
 * Returns `404` when push isn't configured server-side too — that
 * way the client treats "push is off" the same as "world is gated":
 * no opt-in shown.
 */
import { NextResponse } from "next/server";
import { loadPublicWorldBySlug } from "@/lib/mobility/world-resolver";
import { getVapidPublicKey } from "@/lib/mobility/world-push";

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
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: "push_disabled" }, { status: 404 });
  }
  return NextResponse.json(
    { publicKey: key },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
