import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveDeviceStyles } from "@/lib/mobility/device-style-resolver";
import { Operator } from "./Operator";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = {
  title: "Operator console",
};

/**
 * `/org/[orgId]/projects/[projectId]` — the operator console.
 * Server component does the auth check; the map + drawer live in
 * the client component.
 */
export default async function OperatorPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  if (!membership) notFound();

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    select: { id: true, sceneData: true },
  });
  if (!project) notFound();

  // Read default map centre + zoom from the Identity-saved blob.
  // Falls back to Thessaloniki when the operator hasn't set them yet.
  const scene = (project.sceneData ?? {}) as Record<string, unknown>;
  const mobility = (scene.mobility ?? {}) as Record<string, unknown>;
  const branding = (mobility.branding ?? {}) as Record<string, unknown>;
  const centre = branding.defaultCentre as
    | { lat?: unknown; lng?: unknown }
    | undefined;
  const defaultCentre: { lat: number; lng: number } =
    centre &&
    typeof centre.lat === "number" &&
    typeof centre.lng === "number"
      ? { lat: centre.lat, lng: centre.lng }
      : { lat: 40.6401, lng: 22.9444 };
  const defaultZoom =
    typeof branding.defaultZoom === "number" ? branding.defaultZoom : 11;

  const styleMap = await resolveDeviceStyles(projectId);

  return (
    <Operator
      projectId={projectId}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null}
      sourcesHref={`/org/${orgId}/projects/${projectId}/sources`}
      defaultCentre={defaultCentre}
      defaultZoom={defaultZoom}
      styleIcons={styleMap.icons}
      customIcons={styleMap.customIcons}
    />
  );
}
