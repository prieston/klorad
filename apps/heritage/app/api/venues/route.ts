/**
 * GET  /api/venues?organizationId=… — list Heritage venues in an org.
 * POST /api/venues                  — create a venue.
 *
 * A venue is a `Project` plus its 1:1 `HeritageVenue` row, written in one
 * transaction. The Project supplies tenancy, membership and the publish flag;
 * the HeritageVenue row supplies everything domain-specific and, by existing,
 * marks the Project as Heritage-shaped.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { guarded, readJson, slugSchema } from "@/lib/heritage/crud";
import { pickLocalized } from "@/lib/heritage/i18n";

const VENUE_KINDS = [
  "museum",
  "archaeological_site",
  "monument",
  "collection",
  "cultural_route",
] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const organizationId = new URL(req.url).searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json(
      { error: "organizationId is required" },
      { status: 400 },
    );
  }
  const denied = await requireOrgAccess(organizationId, "read");
  if (denied) return denied;

  const venues = await prisma.heritageVenue.findMany({
    where: { project: { organizationId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      kind: true,
      name: true,
      languages: true,
      defaultLanguage: true,
      createdAt: true,
      project: { select: { id: true, isPublished: true } },
    },
  });

  return NextResponse.json({
    venues: venues.map((v) => ({
      id: v.id,
      projectId: v.project.id,
      slug: v.slug,
      kind: v.kind,
      name: pickLocalized(v.name, v.defaultLanguage, "en"),
      languages: v.languages,
      defaultLanguage: v.defaultLanguage,
      isPublished: v.project.isPublished,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

const CreateBody = z.object({
  organizationId: z.string().min(1),
  /** Plain string for convenience: the console creates a venue before the
   *  curator has chosen their language set, so the name starts monolingual and
   *  is expanded on the settings page. Stored as `{ [defaultLanguage]: name }`. */
  name: z.string().min(2).max(160),
  slug: slugSchema,
  kind: z.enum(VENUE_KINDS).default("museum"),
  defaultLanguage: z.string().min(2).max(35).default("en"),
});

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = await readJson(req, CreateBody);
  if ("error" in parsed) return parsed.error;
  const { organizationId, name, slug, kind, defaultLanguage } = parsed.data;

  const denied = await requireOrgAccess(organizationId, "write");
  if (denied) return denied;

  return guarded(async () => {
    const venue = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId,
          title: name,
          // Heritage renders in Three.js only (§5.1). The column is a poor
          // vertical discriminator — Campus and Mobility both write `mapbox`
          // — but it is still the honest value for what this project renders
          // with, and the editor reads it.
          engine: "three",
          sceneData: {},
          isPublished: false,
        },
        select: { id: true },
      });

      return tx.heritageVenue.create({
        data: {
          projectId: project.id,
          slug,
          kind,
          name: { [defaultLanguage]: name },
          defaultLanguage,
          languages: [defaultLanguage],
        },
        select: { id: true, slug: true },
      });
    });

    return NextResponse.json({ id: venue.id, slug: venue.slug }, { status: 201 });
  });
}
