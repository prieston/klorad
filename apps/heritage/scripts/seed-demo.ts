/**
 * Seed a demonstrable Heritage venue.
 *
 * Populates one venue with the whole chain — spaces, periods, actors, objects
 * with rights, captures with paradata, a composed scene, proxies bound to
 * objects, and a tour — so the console and the public page have something real
 * to show. Everything it writes is tagged with the `demo-` slug prefix and can
 * be removed again with `--reset`.
 *
 * Usage, from the repo root:
 *
 *   pnpm --filter @klorad/heritage seed:demo -- --venue <venueId>
 *   pnpm --filter @klorad/heritage seed:demo -- --org <organizationId>
 *   pnpm --filter @klorad/heritage seed:demo -- --venue <venueId> --reset
 *
 * Geometry: the captures point at Khronos glTF Sample Assets over their public
 * CORS-enabled URLs. That is a stand-in so the viewer has real geometry to
 * load, not heritage material — which is why every seeded capture carries
 * `cne` (Copyright Not Evaluated) rather than a licence this script would be
 * asserting on someone else's behalf.
 *
 * The rights setup is deliberately instructive: the objects are Public Domain
 * Mark, the captures are CNE. With the venue's scan policy off, a capture
 * resolves to the object's PDM; with it on, it resolves to the more
 * restrictive CNE. Toggling it in venue settings visibly changes the Rights
 * page, which is the rule in §7.2.6 doing real work.
 */
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

/** Khronos glTF Sample Assets — public, CORS-enabled, real geometry. */
const SAMPLE = (name: string, binary: string) =>
  `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/${name}/glTF-Binary/${binary}.glb`;

const OBJECTS = [
  {
    slug: "demo-kore",
    identifier: "DEMO 1987.42",
    title: { en: "Marble kore", el: "Μαρμάρινη κόρη" },
    description: {
      en: "A draped female figure, recovered from the sanctuary terrace. The polychromy survives in traces on the himation.",
      el: "Γυναικεία μορφή με πτυχωτό ένδυμα, από το άνδηρο του ιερού. Η πολυχρωμία σώζεται κατά τόπους στο ιμάτιο.",
    },
    objectType: "statue",
    materials: ["marble", "pigment"],
    period: "classical",
    space: "demo-classical-gallery",
    model: SAMPLE("DamagedHelmet", "DamagedHelmet"),
    capture: {
      method: "photogrammetry" as const,
      deviceName: "Sony A7R IV, 61MP, 240 images",
      accuracyMeters: 0.0008,
      intendedPurpose: "Condition documentation and public presentation",
      vigieComplexity: "Complex geometry, matte surface",
    },
  },
  {
    slug: "demo-amphora",
    identifier: "DEMO 1991.7",
    title: { en: "Black-figure amphora", el: "Μελανόμορφος αμφορέας" },
    description: {
      en: "Neck amphora with a departure scene. Attributed to the circle of the Antimenes Painter.",
      el: "Αμφορέας λαιμού με παράσταση αναχώρησης. Αποδίδεται στον κύκλο του Ζωγράφου του Αντιμένη.",
    },
    objectType: "amphora",
    materials: ["terracotta", "slip"],
    period: "classical",
    space: "demo-classical-gallery",
    model: SAMPLE("Avocado", "Avocado"),
    capture: {
      method: "structured_light" as const,
      deviceName: "Artec Space Spider",
      accuracyMeters: 0.00005,
      intendedPurpose: "Study copy for researchers",
      vigieComplexity: "Reflective surface, fine surface detail",
    },
  },
  {
    slug: "demo-figurine",
    identifier: "DEMO 2004.113",
    title: { en: "Terracotta figurine", el: "Πήλινο ειδώλιο" },
    description: {
      en: "Standing female figurine from a chamber tomb. Mould-made, with hand-finished detail.",
      el: "Όρθιο γυναικείο ειδώλιο από θαλαμωτό τάφο. Μητρικής κατασκευής, με λεπτομέρειες δουλεμένες στο χέρι.",
    },
    objectType: "figurine",
    materials: ["terracotta"],
    period: "bronze-age",
    space: "demo-prehistoric-gallery",
    model: SAMPLE("Duck", "Duck"),
    capture: {
      method: "photogrammetry" as const,
      deviceName: "Canon R5, turntable rig, 180 images",
      accuracyMeters: 0.0002,
      intendedPurpose: "Public web presentation",
      vigieComplexity: "Small object, simple geometry",
    },
  },
];

async function resolveVenue(): Promise<string> {
  const venueId = arg("venue");
  if (venueId) {
    const v = await prisma.heritageVenue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });
    if (!v) throw new Error(`No venue with id ${venueId}`);
    return v.id;
  }

  const orgId = arg("org");
  if (!orgId) {
    throw new Error("Pass --venue <venueId> or --org <organizationId>");
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) throw new Error(`No organisation with id ${orgId}`);

  const existing = await prisma.heritageVenue.findUnique({
    where: { slug: "demo-museum" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const project = await prisma.project.create({
    data: {
      organizationId: orgId,
      title: "Demo — Archaeological Museum",
      engine: "three",
      sceneData: {},
      isPublished: true,
    },
    select: { id: true },
  });
  const venue = await prisma.heritageVenue.create({
    data: {
      projectId: project.id,
      slug: "demo-museum",
      kind: "museum",
      name: {
        en: "Demo — Archaeological Museum",
        el: "Επίδειξη — Αρχαιολογικό Μουσείο",
      },
      summary: {
        en: "A seeded venue for development. Not a real institution.",
        el: "Χώρος επίδειξης για ανάπτυξη. Δεν αντιστοιχεί σε πραγματικό ίδρυμα.",
      },
      languages: ["en", "el"],
      defaultLanguage: "en",
      scanOfPublicDomainAssertsRights: false,
      defaultRights: "cne",
    },
    select: { id: true },
  });
  return venue.id;
}

async function reset(venueId: string) {
  // Ordered by dependency; cascades cover most of it but being explicit means
  // a partial run leaves nothing dangling.
  await prisma.heritageTour.deleteMany({
    where: { venueId, slug: { startsWith: "demo-" } },
  });
  await prisma.heritageProxy.deleteMany({ where: { venueId } });
  await prisma.heritageScene.deleteMany({
    where: { venueId, slug: { startsWith: "demo-" } },
  });
  await prisma.heritageRepresentation.deleteMany({
    where: { venueId, object: { slug: { startsWith: "demo-" } } },
  });
  await prisma.heritageObject.deleteMany({
    where: { venueId, slug: { startsWith: "demo-" } },
  });
  await prisma.heritageSpace.deleteMany({
    where: { venueId, slug: { startsWith: "demo-" } },
  });
  await prisma.heritagePeriod.deleteMany({ where: { venueId } });
  await prisma.heritageActor.deleteMany({ where: { venueId } });
  console.log("  reset: demo content removed");
}

async function main() {
  const venueId = await resolveVenue();
  console.log(`Seeding venue ${venueId}`);

  if (flag("reset")) await reset(venueId);

  // Make sure the venue can actually hold bilingual content — a venue created
  // through the console starts monolingual.
  await prisma.heritageVenue.update({
    where: { id: venueId },
    data: { languages: ["en", "el"], defaultLanguage: "en" },
  });

  const spaces: Record<string, string> = {};
  for (const s of [
    {
      slug: "demo-prehistoric-gallery",
      kind: "gallery" as const,
      floor: 0,
      order: 0,
      name: { en: "Prehistoric Gallery", el: "Αίθουσα Προϊστορικών" },
    },
    {
      slug: "demo-classical-gallery",
      kind: "gallery" as const,
      floor: 0,
      order: 1,
      name: { en: "Classical Gallery", el: "Αίθουσα Κλασικών Χρόνων" },
    },
    {
      slug: "demo-west-terrace",
      kind: "exterior" as const,
      floor: null,
      order: 2,
      name: { en: "West Terrace", el: "Δυτικό Άνδηρο" },
    },
  ]) {
    const row = await prisma.heritageSpace.upsert({
      where: { venueId_slug: { venueId, slug: s.slug } },
      create: {
        venueId,
        slug: s.slug,
        kind: s.kind,
        name: s.name,
        floor: s.floor,
        sortOrder: s.order,
        state: "published",
      },
      update: { name: s.name, state: "published" },
      select: { id: true },
    });
    spaces[s.slug] = row.id;
  }
  console.log(`  spaces: ${Object.keys(spaces).length}`);

  const periods: Record<string, string> = {};
  for (const p of [
    {
      key: "bronze-age",
      name: { en: "Late Bronze Age", el: "Ύστερη Εποχή του Χαλκού" },
      start: -1600,
      end: -1100,
    },
    {
      key: "classical",
      name: { en: "Classical", el: "Κλασική περίοδος" },
      start: -480,
      end: -323,
    },
  ]) {
    const existing = await prisma.heritagePeriod.findFirst({
      where: { venueId, name: { equals: p.name } },
      select: { id: true },
    });
    const row =
      existing ??
      (await prisma.heritagePeriod.create({
        data: {
          venueId,
          name: p.name,
          startYear: p.start,
          endYear: p.end,
        },
        select: { id: true },
      }));
    periods[p.key] = row.id;
  }
  console.log(`  periods: ${Object.keys(periods).length}`);

  const contractorName = {
    en: "Aegean Survey & Documentation",
    el: "Αιγαίο Αποτυπώσεις & Τεκμηρίωση",
  };
  const contractor =
    (await prisma.heritageActor.findFirst({
      where: { venueId, name: { equals: contractorName } },
      select: { id: true },
    })) ??
    (await prisma.heritageActor.create({
      data: { venueId, kind: "institution", name: contractorName },
      select: { id: true },
    }));
  console.log("  actors: 1");

  const objectIds: Record<string, string> = {};
  const representationIds: Record<string, string> = {};

  for (const [i, o] of OBJECTS.entries()) {
    const obj = await prisma.heritageObject.upsert({
      where: { venueId_slug: { venueId, slug: o.slug } },
      create: {
        venueId,
        slug: o.slug,
        identifier: o.identifier,
        title: o.title,
        description: o.description,
        objectType: o.objectType,
        materials: o.materials,
        spaceId: spaces[o.space],
        periodId: periods[o.period],
        // The museum's own declaration about its own object. Combined with
        // the capture's CNE below, this is what makes the scan policy visible.
        rights: "public_domain_mark",
        rightsHolder: "Demo — Archaeological Museum",
        creditLine: {
          en: "Demo — Archaeological Museum",
          el: "Επίδειξη — Αρχαιολογικό Μουσείο",
        },
        sortOrder: i,
        state: "published",
      },
      update: {
        title: o.title,
        description: o.description,
        state: "published",
      },
      select: { id: true },
    });
    objectIds[o.slug] = obj.id;

    const existingRep = await prisma.heritageRepresentation.findFirst({
      where: { venueId, objectId: obj.id },
      select: { id: true },
    });

    const rep =
      existingRep ??
      (await prisma.heritageRepresentation.create({
        data: {
          venueId,
          objectId: obj.id,
          kind: "mesh",
          status: "ready",
          state: "published",
          label: {
            en: `${o.title.en} — demo geometry`,
            el: `${o.title.el} — γεωμετρία επίδειξης`,
          },
          triangleCount: 15000 + i * 4000,
          // Stand-in geometry, not heritage material. CNE is the honest value
          // rather than a licence this script would be asserting for someone
          // else's asset.
          rights: "cne",
          rightsNote:
            "Placeholder geometry from the Khronos glTF Sample Assets. Replace with the real capture before publication.",
        },
        select: { id: true },
      }));
    representationIds[o.slug] = rep.id;

    await prisma.heritageRepresentationFile.deleteMany({
      where: { representationId: rep.id },
    });
    await prisma.heritageRepresentationFile.create({
      data: {
        representationId: rep.id,
        purpose: "delivery",
        storageKey: `demo/${o.slug}.glb`,
        url: o.model,
        format: "glb",
        mimeType: "model/gltf-binary",
        sizeBytes: BigInt(3_500_000),
      },
    });

    await prisma.heritageParadata.upsert({
      where: { representationId: rep.id },
      create: {
        representationId: rep.id,
        method: o.capture.method,
        deviceName: o.capture.deviceName,
        capturedAt: new Date(Date.UTC(2026, 2 + i, 14)),
        processedAt: new Date(Date.UTC(2026, 2 + i, 16)),
        operatorActorId: contractor.id,
        accuracyMeters: o.capture.accuracyMeters,
        intendedPurpose: o.capture.intendedPurpose,
        vigieComplexity: o.capture.vigieComplexity,
        processingChain: [
          { tool: "RealityCapture", version: "1.4", step: "alignment + mesh" },
          { tool: "Blender", version: "4.2", step: "retopology, UV, bake" },
          { tool: "gltfpack", version: "0.22", step: "meshopt + KTX2" },
        ],
      },
      update: { method: o.capture.method },
    });
  }
  console.log(`  objects: ${OBJECTS.length} (each with a capture + paradata)`);

  const scene = await prisma.heritageScene.upsert({
    where: { venueId_slug: { venueId, slug: "demo-classical-gallery-scene" } },
    create: {
      venueId,
      slug: "demo-classical-gallery-scene",
      spaceId: spaces["demo-classical-gallery"],
      kind: "composite",
      status: "ready",
      state: "published",
      title: { en: "Classical Gallery", el: "Αίθουσα Κλασικών Χρόνων" },
      description: {
        en: "The gallery interior with its display objects.",
        el: "Το εσωτερικό της αίθουσας με τα εκθέματά της.",
      },
      initialCamera: { position: [0, 1.6, 4], target: [0, 1, 0], fov: 50 },
      triangleCount: 34000,
    },
    update: { state: "published" },
    select: { id: true },
  });

  await prisma.heritageSceneLayer.deleteMany({ where: { sceneId: scene.id } });
  const layerObjects = ["demo-kore", "demo-amphora"];
  for (const [i, slug] of layerObjects.entries()) {
    await prisma.heritageSceneLayer.create({
      data: {
        sceneId: scene.id,
        representationId: representationIds[slug],
        role: i === 0 ? "base" : "object",
        sortOrder: i,
        transform: {
          position: [i * 1.8 - 0.9, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    });
  }
  console.log(`  scene: 1 with ${layerObjects.length} layers`);

  await prisma.heritageProxy.deleteMany({ where: { sceneId: scene.id } });
  for (const [i, slug] of layerObjects.entries()) {
    await prisma.heritageProxy.create({
      data: {
        venueId,
        sceneId: scene.id,
        objectId: objectIds[slug],
        shape: "box",
        interaction: "info",
        state: "published",
        sortOrder: i,
        transform: {
          position: [i * 1.8 - 0.9, 0.9, 0],
          rotation: [0, 0, 0, 1],
          scale: [0.9, 1.8, 0.9],
        },
        label: OBJECTS.find((o) => o.slug === slug)!.title,
      },
    });
  }
  console.log(`  proxies: ${layerObjects.length}`);

  const tour = await prisma.heritageTour.upsert({
    where: { venueId_slug: { venueId, slug: "demo-highlights" } },
    create: {
      venueId,
      slug: "demo-highlights",
      title: { en: "Highlights in twenty minutes", el: "Τα κυριότερα σε είκοσι λεπτά" },
      description: {
        en: "Three objects, one route, on a screen or in a headset.",
        el: "Τρία εκθέματα, μία διαδρομή, σε οθόνη ή σε κράνος.",
      },
      mode: "both",
      state: "published",
      estimatedMinutes: 20,
      isAccessibleRoute: true,
    },
    update: { state: "published" },
    select: { id: true },
  });

  await prisma.heritageTourStop.deleteMany({ where: { tourId: tour.id } });
  for (const [i, o] of OBJECTS.entries()) {
    await prisma.heritageTourStop.create({
      data: {
        tourId: tour.id,
        sceneId: i < 2 ? scene.id : null,
        objectId: objectIds[o.slug],
        sortOrder: i,
        title: o.title,
        body: o.description,
        cameraPose: { position: [i * 1.8 - 0.9, 1.4, 2.2], target: [i * 1.8 - 0.9, 1, 0], fov: 45 },
      },
    });
  }
  console.log(`  tour: 1 with ${OBJECTS.length} stops`);

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { slug: true, project: { select: { isPublished: true } } },
  });
  console.log(
    `\nDone. Public page: /v/${venue?.slug}${venue?.project.isPublished ? "" : "  (venue is still a draft — publish it in settings)"}`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
