import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { mobilityConnectors } from "@/lib/connectors";
import { SourcesClient } from "./SourcesClient";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = {
  title: "Data sources",
};

/**
 * `/org/[orgId]/projects/[projectId]/sources` — the data-source
 * settings screen. SSR-loads the project header + existing sources;
 * the client renders the add/edit form and approve/test/sync actions.
 */
export default async function SourcesPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  // Cheap org-membership check; the API enforces the full RBAC.
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
    select: { id: true, title: true },
  });
  if (!project) notFound();

  const initialSources = await prisma.mobilityDataSource.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      connectorId: true,
      label: true,
      config: true,
      enabled: true,
      pollIntervalSeconds: true,
      lastSyncedAt: true,
      lastError: true,
      syncStatus: true,
      syncStartedAt: true,
      syncProgress: true,
    },
  });

  const availableConnectors = mobilityConnectors.list();

  // Marshal Date / JSON fields into the client-friendly shape the
  // SourcesClient expects (Date → ISO string; JSON value → typed
  // SyncProgress shape).
  const serialised = initialSources.map((s) => ({
    ...s,
    syncStartedAt: s.syncStartedAt ? s.syncStartedAt.toISOString() : null,
    syncProgress:
      s.syncProgress && typeof s.syncProgress === "object"
        ? (s.syncProgress as unknown as {
            subsystem: string | null;
            page: number;
            seen: number;
            inserted: number;
            updated: number;
            message?: string;
          })
        : null,
  }));

  return (
    <SourcesClient
      projectId={projectId}
      projectTitle={project.title}
      initialSources={serialised}
      availableConnectors={availableConnectors}
    />
  );
}
