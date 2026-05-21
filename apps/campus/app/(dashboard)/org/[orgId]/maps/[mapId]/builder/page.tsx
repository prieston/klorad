import { redirect } from "next/navigation";

/**
 * Phase 6b — `/builder` is gone. The Workbench replaced it.
 *
 * Old links (bookmarks, shared URLs, anyone still typing
 * `/builder`) land here and get bounced to the new editor with no
 * visible disruption. The redirect is permanent at the routing
 * level (Next.js issues a 308) so search engines / clients update
 * their caches.
 */
export default async function BuilderRedirect({
  params,
}: {
  params: Promise<{ orgId: string; mapId: string }>;
}) {
  const { orgId, mapId } = await params;
  redirect(`/org/${orgId}/maps/${mapId}/workbench`);
}
