import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  STOCK_DEVICE_ICONS,
  defaultIconKeyForSubsystem,
} from "@/lib/mobility/device-icons";
import { listProjectSubsystems } from "@/lib/mobility/device-style-resolver";
import { StylesClient } from "./StylesClient";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = {
  title: "Device styles",
};

/**
 * `/org/[orgId]/projects/[projectId]/styles` — per-subsystem icon
 * picker. The operator chooses one stock icon per device class so the
 * map reads as `camera here, sign there, weather station there` at a
 * glance instead of a uniform soup of dots.
 */
export default async function StylesPage({ params }: { params: Params }) {
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
    select: { id: true, title: true },
  });
  if (!project) notFound();

  const [subsystems, rows] = await Promise.all([
    listProjectSubsystems(projectId),
    prisma.mobilityDeviceStyle.findMany({
      where: { projectId },
      select: { subsystem: true, iconKey: true },
    }),
  ]);
  const overrides = new Map(rows.map((r) => [r.subsystem, r.iconKey]));
  const initial = subsystems.map((subsystem) => ({
    subsystem,
    iconKey: overrides.get(subsystem) ?? defaultIconKeyForSubsystem(subsystem),
    isOverride: overrides.has(subsystem),
  }));

  return (
    <StylesClient
      projectId={projectId}
      projectTitle={project.title}
      initialStyles={initial}
      iconLibrary={STOCK_DEVICE_ICONS.map((entry) => ({
        key: entry.key,
        label: entry.label,
        description: entry.description,
      }))}
    />
  );
}
