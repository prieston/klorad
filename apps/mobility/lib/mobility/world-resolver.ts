/**
 * Server-side resolvers for the public `/w/[slug]` route.
 *
 *   - `loadPublicWorldBySlug(slug)` — anonymous, used by manifest +
 *     SW data endpoint. Returns null for drafts and `authenticated`
 *     worlds so probes can't enumerate slug existence.
 *
 *   - `resolveWorldForViewer(slug, viewerId)` — the page resolver.
 *     Returns a discriminated result so the page can render the
 *     right surface (sign-in CTA, no-access panel, or viewer).
 *
 * Both return the small set of fields the public surface needs (slug,
 * name, description, theme, visibility) plus the curated device list
 * with everything trimmed to what a stakeholder sees. Internal source
 * URLs and curation flags never leave the dashboard tier.
 */
import { prisma } from "@/lib/prisma";
import { resolveDeviceStyles } from "./device-style-resolver";

export interface PublicWorldDevice {
  id: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  type: string | null;
  lat: number | null;
  lng: number | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
}

export interface PublicWorld {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: "public" | "linkOnly" | "authenticated";
  /// Theme bag from the operator. PR4 layers branding (logo, colors)
  /// on top of the defaults baked into the viewer.
  theme: Record<string, unknown>;
  /// Project context — name only, used in the manifest's category
  /// metadata. The viewer never shows the project to the visitor.
  projectId: string;
  projectTitle: string;
  devices: PublicWorldDevice[];
  /// Subsystem → iconKey resolved from the operator's project-level
  /// `MobilityDeviceStyle` rows. Used by the viewer's symbol layer.
  styleIcons: Record<string, string>;
  /// Subsystem → 3D modelKey. Used when the visitor turns on the
  /// "3D devices" toggle.
  styleModels: Record<string, string>;
  /// Per-id descriptor of every custom upload referenced by the
  /// project's styles. Lets the viewer's loader resolve `custom:<id>`
  /// keys without a second round-trip.
  customIcons: Record<string, import("./device-style-resolver").CustomIconRef>;
}

/**
 * Load a world by slug. Drafts → null. `authenticated` worlds → null
 * for now (PR4 wires the sign-in gate). `public` and `linkOnly` →
 * resolved with curated devices.
 *
 * Caller decides what to do with `null` — `page.tsx` calls
 * `notFound()` so an unknown / unpublished / auth-only slug surfaces
 * the same 404 as a typo. That's intentional: it prevents an
 * enumeration attack that could probe for which slugs exist.
 */
/**
 * Discriminated result returned by `resolveWorldForViewer`. Lets the
 * page render the right surface without needing a second DB hit:
 *
 *   ok           — world is visible to this viewer; render it
 *   not_found    — draft / unknown slug; render 404
 *   needs_signin — auth-required world + anonymous viewer; redirect
 *                  to the sign-in page with a callback
 *   no_access    — auth-required world + signed-in viewer not in the
 *                  owning organisation; render an access-denied panel
 */
export type WorldResolution =
  | { kind: "ok"; world: PublicWorld }
  | { kind: "not_found" }
  | { kind: "needs_signin" }
  | { kind: "no_access" };

/** Internal query — full include block so each resolver returns the
 *  same shape without duplicating the select. */
const worldInclude = {
  project: { select: { id: true, title: true, organizationId: true } },
  devices: {
    include: {
      device: {
        select: {
          id: true,
          externalDeviceId: true,
          subsystem: true,
          name: true,
          customLabel: true,
          type: true,
          lat: true,
          lng: true,
          primaryRoad: true,
          crossRoad: true,
          direction: true,
        },
      },
    },
  },
} as const;

type WorldRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.mobilityWorld.findFirst<{ include: typeof worldInclude }>>>
>;

async function toPublicWorld(world: WorldRecord): Promise<PublicWorld> {
  const themeRaw = (world.theme ?? {}) as Record<string, unknown>;
  const styleMap = await resolveDeviceStyles(world.project.id);
  return {
    id: world.id,
    slug: world.slug,
    name: world.name,
    description: world.description,
    visibility: world.visibility,
    theme: themeRaw,
    projectId: world.project.id,
    projectTitle: world.project.title,
    devices: world.devices
      .map((m) => m.device)
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => ({
        id: d.id,
        externalDeviceId: d.externalDeviceId,
        subsystem: d.subsystem,
        name: d.customLabel ?? d.name,
        type: d.type,
        lat: d.lat,
        lng: d.lng,
        primaryRoad: d.primaryRoad,
        crossRoad: d.crossRoad,
        direction: d.direction,
      })),
    styleIcons: styleMap.icons,
    styleModels: styleMap.models,
    customIcons: styleMap.customIcons,
  };
}

export async function loadPublicWorldBySlug(
  slug: string,
): Promise<PublicWorld | null> {
  const world = await prisma.mobilityWorld.findFirst({
    where: { slug, isPublished: true },
    include: worldInclude,
  });
  if (!world) return null;
  if (world.visibility === "authenticated") return null;
  return await toPublicWorld(world);
}

/**
 * Page-level resolver. Pass `viewerId` if a session exists.
 * The auth gate is project-org membership: anyone in the owning
 * organisation can view an `authenticated` world. Tighter per-world
 * ACLs can graduate into their own table later.
 */
export async function resolveWorldForViewer(
  slug: string,
  viewerId: string | null,
): Promise<WorldResolution> {
  const world = await prisma.mobilityWorld.findFirst({
    where: { slug, isPublished: true },
    include: worldInclude,
  });
  if (!world) return { kind: "not_found" };
  if (world.visibility !== "authenticated") {
    return { kind: "ok", world: await toPublicWorld(world) };
  }
  if (!viewerId) return { kind: "needs_signin" };
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: world.project.organizationId,
        userId: viewerId,
      },
    },
    select: { role: true },
  });
  if (!membership) return { kind: "no_access" };
  return { kind: "ok", world: await toPublicWorld(world) };
}
