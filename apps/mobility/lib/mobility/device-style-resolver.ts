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
import { defaultModelKeyForSubsystem } from "./device-models";

export interface CustomIconRef {
  id: string;
  url: string;
  contentType: string;
  label: string;
}

export interface DeviceStyleMap {
  /** Lowercased subsystem → resolved iconKey. */
  icons: Record<string, string>;
  /** Lowercased subsystem → resolved 3D modelKey. Phase 3. */
  models: Record<string, string>;
  /** Per-id descriptor of every custom icon currently referenced.
   *  The client loader resolves `custom:<id>` keys against this. */
  customIcons: Record<string, CustomIconRef>;
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
 *  every active subsystem maps to *some* iconKey. Custom icons that
 *  are still referenced get bundled in so the client can resolve the
 *  `custom:<id>` keys without a second round-trip. */
export async function resolveDeviceStyles(
  projectId: string,
): Promise<DeviceStyleMap> {
  const [subsystems, rows] = await Promise.all([
    listProjectSubsystems(projectId),
    prisma.mobilityDeviceStyle.findMany({
      where: { projectId },
      select: { subsystem: true, iconKey: true, modelKey: true },
    }),
  ]);
  const iconOverrides = new Map(rows.map((r) => [r.subsystem, r.iconKey]));
  const modelOverrides = new Map(
    rows
      .filter((r): r is typeof r & { modelKey: string } => Boolean(r.modelKey))
      .map((r) => [r.subsystem, r.modelKey]),
  );
  const icons: Record<string, string> = {};
  const models: Record<string, string> = {};
  for (const subsystem of subsystems) {
    icons[subsystem] =
      iconOverrides.get(subsystem) ?? defaultIconKeyForSubsystem(subsystem);
    models[subsystem] =
      modelOverrides.get(subsystem) ?? defaultModelKeyForSubsystem(subsystem);
  }

  const customIds = Array.from(
    new Set(
      Object.values(icons)
        .filter((k) => k.startsWith("custom:"))
        .map((k) => k.slice("custom:".length)),
    ),
  );
  const customIcons: Record<string, CustomIconRef> = {};
  if (customIds.length) {
    const rows = await prisma.mobilityCustomIcon.findMany({
      where: { projectId, id: { in: customIds } },
      select: { id: true, url: true, contentType: true, label: true },
    });
    for (const r of rows) customIcons[r.id] = r;
    // Self-heal: if a style still points at a deleted custom icon
    // (race between style save and icon delete), fall back to the
    // stock default rather than leave a dangling reference.
    for (const subsystem of subsystems) {
      const k = icons[subsystem];
      if (k.startsWith("custom:") && !customIcons[k.slice(7)]) {
        icons[subsystem] = defaultIconKeyForSubsystem(subsystem);
      }
    }
  }

  return { icons, models, customIcons };
}
