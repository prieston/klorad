import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IdentityClient } from "./IdentityClient";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Identity" };

/** Read the typed shape we persist for Mobility-specific config out of
 *  the loosely-typed `sceneData` JSON blob. */
function readBranding(scene: unknown): {
  primaryColor: string | null;
  defaultCentre: { lat: number; lng: number } | null;
  defaultZoom: number | null;
} {
  const sd = (scene ?? {}) as Record<string, unknown>;
  const mobility = (sd.mobility ?? {}) as Record<string, unknown>;
  const branding = (mobility.branding ?? {}) as Record<string, unknown>;
  const centre = branding.defaultCentre as
    | { lat?: unknown; lng?: unknown }
    | undefined;
  return {
    primaryColor:
      typeof branding.primaryColor === "string"
        ? (branding.primaryColor as string)
        : null,
    defaultCentre:
      centre && typeof centre.lat === "number" && typeof centre.lng === "number"
        ? { lat: centre.lat as number, lng: centre.lng as number }
        : null,
    defaultZoom:
      typeof branding.defaultZoom === "number"
        ? (branding.defaultZoom as number)
        : null,
  };
}

export default async function ProjectIdentityPage({
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
    select: {
      id: true,
      title: true,
      thumbnail: true,
      sceneData: true,
    },
  });
  if (!project) notFound();

  const branding = readBranding(project.sceneData);

  return (
    <IdentityClient
      projectId={projectId}
      initial={{
        title: project.title,
        thumbnail: project.thumbnail,
        sceneData: project.sceneData as Record<string, unknown>,
        primaryColor: branding.primaryColor ?? "#534ab7",
        defaultCentre: branding.defaultCentre ?? { lat: 40.6401, lng: 22.9444 },
        defaultZoom: branding.defaultZoom ?? 11,
      }}
    />
  );
}
