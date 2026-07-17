/**
 * `GET /api/public/worlds/[slug]/vapid-public-key`
 *
 * Returns the VAPID public key the world's PWA needs to subscribe to
 * push. Anonymous for public / linkOnly worlds; session-gated for
 * `authenticated` worlds (via `loadWorldForPushViewer`). The key is
 * safe to expose by design — clients couldn't sign pushes without
 * the private key. Draft / unknown slugs 404 the same way the
 * manifest does, keeping unpublished worlds hidden from probes.
 *
 * Distinct status codes so the client can differentiate:
 *   404 → world not found or viewer lacks access
 *   503 → push not configured server-side (no VAPID env vars)
 */
import { NextResponse } from "next/server";
import { loadWorldForPushViewer } from "@/lib/mobility/world-resolver";
import { getVapidPublicKey } from "@/lib/mobility/world-push";

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
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: "push_disabled" }, { status: 503 });
  }
  return NextResponse.json(
    { publicKey: key },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
