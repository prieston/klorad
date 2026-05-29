import { NextResponse } from "next/server";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { listDiningForProject } from "@/lib/dining-db";

type Params = Promise<{ token: string }>;

/**
 * `GET /api/campus/[token]/dining`
 *
 * Public dining locations feed. Same pattern as news / events /
 * clubs: SSR seeds, SWR revalidates on focus / reconnect.
 */
export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  if (!map || !map.isPublished) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dining = await listDiningForProject(map.id).catch(() => []);
  return NextResponse.json({ dining });
}
