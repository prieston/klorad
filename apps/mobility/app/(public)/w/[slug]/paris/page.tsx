import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveWorldForViewer } from "@/lib/mobility/world-resolver";
import { WorldAccessDenied } from "../WorldAccessDenied";
import { ParisPanel } from "./ParisPanel";

type Params = Promise<{ slug: string }>;

export const metadata = { title: "Paris" };

/**
 * `/w/[slug]/paris` — mobility world assistant tab. Same
 * visibility branching as the parent world route.
 */
export default async function WorldParisPage({
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
    const callback = encodeURIComponent(`/w/${slug}/paris`);
    redirect(`/auth/signin?callbackUrl=${callback}`);
  }
  if (result.kind === "no_access") {
    return <WorldAccessDenied slug={slug} />;
  }

  return (
    <ParisPanel
      slug={result.world.slug}
      worldId={result.world.id}
      worldName={result.world.name}
    />
  );
}
