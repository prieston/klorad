/**
 * Publish-gate helpers. v1 inlines them here; once a third vertical
 * appears they graduate into @klorad/sync alongside the discovered-
 * items lifecycle.
 *
 * Two layers gate visibility:
 *   - project: isPublished (rector hasn't gone live yet) +
 *              isPublic   (private demo vs. anonymous-accessible)
 *   - per-row: MobilityDevice.isPublic (operator opted this device in)
 *
 * Both must be true for an anonymous visitor to see the device.
 * Operator dashboard ignores the per-row gate (they own the curation
 * and need to see uncurated rows too).
 */
import { prisma } from "@/lib/prisma";

export interface PublicProject {
  id: string;
  title: string;
  isPublished: boolean;
  isPublic: boolean;
}

export async function loadPublicProject(
  projectId: string,
): Promise<PublicProject | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, isPublished: true, isPublic: true },
  });
  return project;
}

export function projectIsPubliclyVisible(project: PublicProject): boolean {
  return project.isPublished && project.isPublic;
}
