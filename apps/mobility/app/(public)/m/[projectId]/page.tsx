import { notFound } from "next/navigation";
import {
  loadPublicProject,
  projectIsPubliclyVisible,
} from "@/lib/mobility/publish-gate";
import { PublicTravellerMap } from "./PublicTravellerMap";

type Params = Promise<{ projectId: string }>;

/**
 * `/m/[projectId]` — the public traveller surface. Anonymous,
 * read-only, no curation UI. Renders only devices that the operator
 * has flagged `isPublic` and only when the project is both
 * `isPublished` and `isPublic`. Anything else 404s.
 */
export default async function PublicMapPage({
  params,
}: {
  params: Params;
}) {
  const { projectId } = await params;
  const project = await loadPublicProject(projectId);
  if (!project || !projectIsPubliclyVisible(project)) notFound();

  return (
    <PublicTravellerMap
      projectId={projectId}
      projectTitle={project.title}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null}
    />
  );
}
