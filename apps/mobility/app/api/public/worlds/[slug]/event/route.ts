/**
 * `POST /api/public/worlds/[slug]/event`
 *   Body: { kind: "view" | "install", anonId: string }
 *
 * Anonymous visitor beacon. The client fires this on page mount
 * ("view") and on the browser's `appinstalled` event. Other event
 * kinds (subscribe / broadcast) are emitted server-side from the
 * action that creates them — we explicitly reject those here so the
 * client can't backfill fake subscriber counts.
 *
 * The world resolver gates the slug the same way the manifest does,
 * so unpublished worlds quietly 404.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadPublicWorldBySlug } from "@/lib/mobility/world-resolver";
import { recordWorldEvent } from "@/lib/mobility/world-events";

type Params = Promise<{ slug: string }>;

const Body = z.object({
  kind: z.enum(["view", "install"]),
  anonId: z.string().min(8).max(64),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { slug } = await params;
  const world = await loadPublicWorldBySlug(slug);
  if (!world) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await recordWorldEvent({
    worldId: world.id,
    kind: parsed.data.kind,
    anonId: parsed.data.anonId,
  });
  return NextResponse.json({ ok: true });
}
