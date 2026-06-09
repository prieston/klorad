import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
    select: { id: true },
  });
  if (!project) notFound();

  return (
    <Operator
      projectId={projectId}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null}
      sourcesHref={`/org/${orgId}/projects/${projectId}/sources`}
    />
  );
}
