import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveWorldForViewer } from "@/lib/mobility/world-resolver";
import { WorldViewer } from "./WorldViewer";
import { WorldAccessDenied } from "./WorldAccessDenied";

type Params = Promise<{ slug: string }>;

/**
 * `/w/[slug]` — public viewer for one mobility world.
 *
 * Visibility branches:
 *   - public + linkOnly → render the viewer for anyone
 *   - authenticated + anon → redirect to sign-in with this URL as
 *     the callback, so the stakeholder lands back in the world
 *   - authenticated + signed-in but not in the owning org → render
 *     a low-key access-denied panel; they may have followed a link
 *     for a world they aren't part of
 */
export default async function WorldPublicPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const session = await auth();
  const viewerId = (session?.user?.id as string | undefined) ?? null;
  const result = await resolveWorldForViewer(slug, viewerId);

  if (result.kind === "not_found") notFound();
  if (result.kind === "needs_signin") {
    const callback = encodeURIComponent(`/w/${slug}`);
    redirect(`/auth/signin?callbackUrl=${callback}`);
  }
  if (result.kind === "no_access") {
    return <WorldAccessDenied slug={slug} />;
  }

  const world = result.world;
  return (
    <WorldViewer
      slug={world.slug}
      name={world.name}
      description={world.description}
      devices={world.devices}
      theme={world.theme}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null}
      styleIcons={world.styleIcons}
    />
  );
}
