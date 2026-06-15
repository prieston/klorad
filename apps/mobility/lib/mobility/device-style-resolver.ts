/**
 * Server-side style resolution. Given a project, returns a map of
 * subsystem → iconKey so the operator console + public world viewer
 * can paint device markers consistently.
 *
 * Resolution order per subsystem:
 *   1. The MobilityDeviceStyle row for `(projectId, subsystem)` if
 *      one exists.
 *   2. The stock default chosen by `defaultIconKeyForSubsystem`.
 *
 * Phase 3 will add model resolution here too — same shape, different
 * registry — without changing the caller contract.
 */
import { prisma } from "@/lib/prisma";
import { defaultIconKeyForSubsystem } from "./device-icons";

export interface DeviceStyleMap {
  /** Lowercased subsystem → resolved iconKey. */
  icons: Record<string, string>;
}

/** Distinct subsystems used in the project, in alphabetical order. */
export async function listProjectSubsystems(
  projectId: string,
): Promise<string[]> {
  const rows = await prisma.mobilityDevice.findMany({
    where: { projectId },
    distinct: ["subsystem"],
    select: { subsystem: true },
    orderBy: { subsystem: "asc" },
  });
  return rows.map((r) => r.subsystem);
}

/** Load operator-set rows + merge them with subsystem defaults so
 *  every active subsystem maps to *some* iconKey. */
export async function resolveDeviceStyles(
  projectId: string,
): Promise<DeviceStyleMap> {
  const [subsystems, rows] = await Promise.all([
    listProjectSubsystems(projectId),
    prisma.mobilityDeviceStyle.findMany({
      where: { projectId },
      select: { subsystem: true, iconKey: true },
    }),
  ]);
  const overrides = new Map(rows.map((r) => [r.subsystem, r.iconKey]));
  const icons: Record<string, string> = {};
  for (const subsystem of subsystems) {
    icons[subsystem] =
      overrides.get(subsystem) ?? defaultIconKeyForSubsystem(subsystem);
  }
  return { icons };
}
