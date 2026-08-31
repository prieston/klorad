/**
 * End-to-end check of the ingest path against real infrastructure.
 *
 * Unlike `check-probe.ts`, which exercises the parsers in isolation, this one
 * proves the parts that only fail in production: that the storage credentials
 * work, that CORS exposes the `ETag` multipart completion depends on, that the
 * provider honours Range requests, and that a completed upload actually
 * reaches `ready` with a delivery file attached.
 *
 * It writes to whichever database DATABASE_URL points at and uploads a few
 * megabytes. The representation rows are deleted afterwards; the uploaded
 * objects are left behind deliberately, since a bucket that accumulates a
 * handful of test files is a smaller problem than a script that deletes things
 * by pattern.
 *
 *   pnpm --filter @klorad/heritage check:ingest
 */
import { PrismaClient } from "@prisma/client";
import {
  storageConfigFromEnv,
  createMultipartUpload,
  presignUploadPart,
  completeMultipartUpload,
  getObjectRange,
} from "@klorad/storage/server";

import { runIngestJob } from "../lib/heritage/pipeline/run";

const prisma = new PrismaClient();
const cfg = storageConfigFromEnv();

const MODEL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb";

async function main() {
  const venue = await prisma.heritageVenue.findFirst({ select: { id: true, slug: true } });
  if (!venue) throw new Error("no venue");
  console.log(`venue ${venue.slug}`);

  // 1. Real bytes.
  const bytes = new Uint8Array(await (await fetch(MODEL)).arrayBuffer());
  console.log(`downloaded ${(bytes.byteLength / 1024).toFixed(0)} KB`);

  // 2. Real multipart upload to DO Spaces.
  const up = await createMultipartUpload(cfg, {
    fileName: "e2e-helmet.glb",
    fileType: "model/gltf-binary",
    prefix: `heritage/${venue.id}/masters`,
  });
  const signedUrl = await presignUploadPart(cfg, { key: up.key, uploadId: up.uploadId, partNumber: 1 });
  const put = await fetch(signedUrl, { method: "PUT", body: bytes });
  if (!put.ok) throw new Error(`part PUT ${put.status}`);
  const eTag = put.headers.get("etag");
  if (!eTag) throw new Error("no ETag exposed by CORS/headers");
  const done = await completeMultipartUpload(cfg, {
    key: up.key,
    uploadId: up.uploadId,
    parts: [{ partNumber: 1, eTag }],
  });
  console.log(`uploaded -> ${done.key}`);

  // 3. Does the provider honour Range? The whole fast path rests on this: if
  //    Range were ignored, probing a 26 GB master would quietly download 26 GB.
  //    Asked with a range far smaller than the file, so "returned everything"
  //    and "returned what was asked for" cannot be confused.
  const SMALL = 2048;
  const ranged = await getObjectRange(cfg, { key: done.key, start: 0, end: SMALL - 1 });
  const rangeHonoured = ranged.contentLength === SMALL && bytes.byteLength > SMALL;
  console.log(
    `ranged read: asked ${SMALL} B, got ${ranged.contentLength} B, object is ${ranged.totalLength} B ` +
      `— Range ${rangeHonoured ? "HONOURED" : "IGNORED"}`,
  );
  if (!rangeHonoured) {
    throw new Error(
      "The storage provider did not honour a Range request. Probing would download whole files.",
    );
  }

  // 4. Records, as the complete route would create them.
  const rep = await prisma.heritageRepresentation.create({
    data: { venueId: venue.id, kind: "mesh", status: "queued", label: { en: "E2E helmet" } },
    select: { id: true },
  });
  await prisma.heritageRepresentationFile.create({
    data: {
      representationId: rep.id,
      purpose: "master",
      storageKey: done.key,
      url: done.publicUrl,
      format: "glb",
      mimeType: "model/gltf-binary",
      sizeBytes: BigInt(bytes.byteLength),
    },
  });
  const job = await prisma.heritageIngestJob.create({
    data: {
      venueId: venue.id,
      representationId: rep.id,
      kind: "mesh_pipeline",
      status: "queued",
      parameters: { sourceKey: done.key },
    },
    select: { id: true },
  });

  // 5. Run the actual pipeline.
  const outcome = await runIngestJob(job.id);
  console.log("outcome:", JSON.stringify(outcome));

  const after = await prisma.heritageRepresentation.findUnique({
    where: { id: rep.id },
    include: { files: true },
  });
  console.log(
    `status=${after?.status} triangles=${after?.triangleCount} box=${JSON.stringify(after?.boundingBox)}`,
  );
  console.log(`files: ${after?.files.map((f) => f.purpose).join(", ")}`);

  // 6. The other outcome that must work: a format Klorad stores but cannot
  //    serve. It should succeed, reach `ready`, and produce no delivery file —
  //    "kept safely" and "shown to visitors" being different promises.
  const archivalRep = await prisma.heritageRepresentation.create({
    data: { venueId: venue.id, kind: "mesh", status: "queued", label: { en: "E2E archival" } },
    select: { id: true },
  });
  await prisma.heritageRepresentationFile.create({
    data: {
      representationId: archivalRep.id,
      purpose: "master",
      storageKey: done.key,
      url: done.publicUrl,
      // The bytes are a GLB; the record claims OBJ. That is the point: the
      // decision must come from the declared format, without reading the file.
      format: "obj",
      sizeBytes: BigInt(bytes.byteLength),
    },
  });
  const archivalJob = await prisma.heritageIngestJob.create({
    data: {
      venueId: venue.id,
      representationId: archivalRep.id,
      kind: "mesh_pipeline",
      status: "queued",
      parameters: { sourceKey: done.key },
    },
    select: { id: true },
  });
  const archivalOutcome = await runIngestJob(archivalJob.id);
  const archivalAfter = await prisma.heritageRepresentation.findUnique({
    where: { id: archivalRep.id },
    include: { files: true },
  });
  console.log(
    `archival: status=${archivalAfter?.status} deliverable=${archivalOutcome.deliverable} ` +
      `files=${archivalAfter?.files.map((f) => f.purpose).join(", ")}`,
  );
  console.log(`  reason: ${archivalOutcome.detail?.slice(0, 90)}…`);

  const pass =
    after?.status === "ready" &&
    after.triangleCount === 15452 &&
    after.files.some((f) => f.purpose === "delivery") &&
    archivalOutcome.status === "succeeded" &&
    archivalOutcome.deliverable === false &&
    archivalAfter?.status === "ready" &&
    !archivalAfter.files.some((f) => f.purpose === "delivery");
  console.log(pass ? "\nE2E PASS" : "\nE2E FAIL");

  // Cascades take the files and jobs with them.
  await prisma.heritageRepresentation.delete({ where: { id: rep.id } });
  await prisma.heritageRepresentation.delete({ where: { id: archivalRep.id } });
  process.exit(pass ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
