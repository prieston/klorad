/**
 * Execute one ingest job.
 *
 * The shape of v1's pipeline follows from one observation: most of what a
 * curator uploads is *already deliverable*. A `.glb` out of Blender or
 * RealityCapture, a JPEG, an MP4 — these need validating and measuring, not
 * transcoding. So the work here is a header read and a database write, which
 * is cheap enough to run inline while the curator is still looking at the
 * screen. Formats that genuinely need conversion are kept as archival masters
 * and named as such, rather than pretending a pipeline exists for them.
 *
 * That split is what lets the loop close now instead of after a render farm.
 */
import * as Sentry from "@sentry/nextjs";
import { getObjectRange, storageConfigFromEnv } from "@klorad/storage/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { archivalOnlyReason, extensionOf } from "@/lib/heritage/ingest";
import {
  GLTF_PROBE_BYTES,
  GltfFormatError,
  parseGltfJson,
  statsFromGltf,
} from "./gltf-probe";
import { IMAGE_PROBE_BYTES, ImageFormatError, probeImage } from "./image-probe";

/** How many times a job is retried before it stops being requeued. Transient
 *  storage errors deserve another go; a corrupt file does not, which is why
 *  terminal failures bypass this entirely. */
export const MAX_ATTEMPTS = 3;

/**
 * A failure the curator caused and can fix. Never retried — running the same
 * bytes through the same parser a second time cannot produce a different
 * answer, and a job that retries three times before reporting "this is not a
 * GLB" just delays the message by two lease periods.
 */
export class PipelineRejection extends Error {}

export interface JobOutcome {
  jobId: string;
  representationId: string;
  status: "succeeded" | "failed";
  /** Whether a visitor can now see this. False for a stored archival master. */
  deliverable: boolean;
  detail: string | null;
}

interface SourceFile {
  id: string;
  purpose: string;
  storageKey: string;
  url: string | null;
  format: string;
  mimeType: string | null;
  sizeBytes: bigint | null;
}

/**
 * Run a job to completion and record the result.
 *
 * Never throws for a job-level failure: the outcome is written to the job row
 * and returned. A thrown error here means the *runner* broke, not the job, and
 * the caller requeues accordingly.
 */
export async function runIngestJob(jobId: string): Promise<JobOutcome> {
  const job = await prisma.heritageIngestJob.findUnique({
    where: { id: jobId },
    include: {
      representation: { include: { files: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!job) throw new Error(`Ingest job ${jobId} no longer exists`);

  await prisma.heritageIngestJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });
  await prisma.heritageRepresentation.update({
    where: { id: job.representationId },
    data: { status: "processing" },
  });

  try {
    const source = pickSourceFile(job.representation.files, job.parameters);
    const result = await execute(job.kind, job.representation.kind, source);

    await prisma.$transaction(async (tx) => {
      if (result.deliverable) await ensureDeliveryFile(tx, job.representationId, source);

      await tx.heritageRepresentation.update({
        where: { id: job.representationId },
        data: {
          status: "ready",
          failureReason: null,
          ...result.stats,
        },
      });
      await tx.heritageIngestJob.update({
        where: { id: jobId },
        data: {
          status: "succeeded",
          finishedAt: new Date(),
          failureReason: null,
          result: {
            deliverable: result.deliverable,
            note: result.detail,
            triangleCount: result.stats.triangleCount ?? null,
            widthPx: result.stats.widthPx ?? null,
            heightPx: result.stats.heightPx ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return {
      jobId,
      representationId: job.representationId,
      status: "succeeded",
      deliverable: result.deliverable,
      detail: result.detail,
    };
  } catch (error) {
    const terminal =
      error instanceof PipelineRejection ||
      error instanceof GltfFormatError ||
      error instanceof ImageFormatError;

    // A curator reads `failureReason`; a developer reads `result`. Keeping the
    // internal message out of the first is the difference between an error
    // someone can act on and a stack trace in a museum's admin panel.
    const message = terminal
      ? (error as Error).message
      : "Processing did not finish because of a temporary problem reading the file. It will be retried automatically.";

    const exhausted = !terminal && job.attempts + 1 >= MAX_ATTEMPTS;

    // Terminal failures are the curator's to fix and are already shown to
    // them. Everything else is ours, and an upload that quietly stops being
    // retried is exactly the kind of thing nobody notices without this.
    if (!terminal) {
      Sentry.captureException(error, {
        level: exhausted ? "error" : "warning",
        tags: { area: "heritage-ingest", jobKind: job.kind },
        extra: { jobId, representationId: job.representationId, attempts: job.attempts + 1 },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.heritageIngestJob.update({
        where: { id: jobId },
        data: {
          status: terminal || exhausted ? "failed" : "queued",
          finishedAt: terminal || exhausted ? new Date() : null,
          claimedAt: null,
          claimedBy: null,
          failureReason: message,
          result: {
            terminal,
            internal: error instanceof Error ? error.message : String(error),
          } as Prisma.InputJsonValue,
        },
      });
      await tx.heritageRepresentation.update({
        where: { id: job.representationId },
        data: {
          status: terminal || exhausted ? "failed" : "queued",
          failureReason: terminal || exhausted ? message : null,
        },
      });
    });

    return {
      jobId,
      representationId: job.representationId,
      status: "failed",
      deliverable: false,
      detail: message,
    };
  }
}

function pickSourceFile(
  files: SourceFile[],
  parameters: Prisma.JsonValue | null,
): SourceFile {
  const wanted =
    parameters && typeof parameters === "object" && !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>).sourceKey
      : undefined;

  const byKey =
    typeof wanted === "string" ? files.find((f) => f.storageKey === wanted) : undefined;
  const file = byKey ?? files.find((f) => f.purpose === "master") ?? files[0];

  if (!file) {
    throw new PipelineRejection(
      "No uploaded file is attached to this representation, so there is nothing to process.",
    );
  }
  return file;
}

interface ExecutionResult {
  deliverable: boolean;
  detail: string | null;
  stats: {
    triangleCount?: number | null;
    // Prisma distinguishes "leave this column alone" (undefined) from "write
    // SQL NULL" (`Prisma.DbNull`); a bare `null` means neither and is
    // rejected. Spelled out because the distinction only bites on nullable
    // Json columns, which is exactly one column in this schema.
    boundingBox?: Prisma.InputJsonValue | typeof Prisma.DbNull;
    widthPx?: number | null;
    heightPx?: number | null;
  };
}

async function execute(
  jobKind: string,
  representationKind: string,
  source: SourceFile,
): Promise<ExecutionResult> {
  const fileName = `x.${source.format}`;
  const archival = archivalOnlyReason(
    representationKind as Parameters<typeof archivalOnlyReason>[0],
    fileName,
  );

  // Nothing to read: the format is stored, not served. Recorded as a success
  // because the upload did succeed — the file is safe, which is most of what
  // an archival master is for.
  if (archival) return { deliverable: false, detail: archival, stats: {} };

  if (jobKind === "mesh_pipeline") return probeMesh(source);
  if (jobKind === "media_probe") return probeMedia(representationKind, source);

  // splat_pipeline and point_cloud_conversion only reach here if a format was
  // added to DELIVERABLE_EXTENSIONS without a pipeline behind it.
  throw new PipelineRejection(
    `No processing pipeline is available for ${jobKind.replace(/_/g, " ")} yet.`,
  );
}

async function probeMesh(source: SourceFile): Promise<ExecutionResult> {
  const bytes = await readHead(source.storageKey, GLTF_PROBE_BYTES);
  const doc = parseGltfJson(bytes, extensionOf(`x.${source.format}`));
  const stats = statsFromGltf(doc);

  return {
    deliverable: true,
    detail: stats.approximate
      ? "Measured without a scene graph, so the bounding box is the union of the mesh extents rather than their placed positions."
      : null,
    stats: {
      triangleCount: stats.triangleCount,
      boundingBox: (stats.boundingBox ?? Prisma.DbNull) as
        | Prisma.InputJsonValue
        | typeof Prisma.DbNull,
    },
  };
}

async function probeMedia(
  representationKind: string,
  source: SourceFile,
): Promise<ExecutionResult> {
  if (representationKind === "image" || representationKind === "panorama") {
    const bytes = await readHead(source.storageKey, IMAGE_PROBE_BYTES);
    const { width, height } = probeImage(bytes, extensionOf(`x.${source.format}`));
    return {
      deliverable: true,
      detail: null,
      stats: { widthPx: width, heightPx: height },
    };
  }

  // Audio and video are served without measurement. Duration lives in a
  // container box that is routinely written at the *end* of the file, so
  // reading it means either a second ranged read at an offset we cannot
  // predict or pulling in a demuxer. Said plainly here rather than left as an
  // unexplained null in the column.
  return {
    deliverable: true,
    detail: "Playable. Duration is not measured at ingest.",
    stats: {},
  };
}

async function readHead(storageKey: string, length: number): Promise<Uint8Array> {
  const { body } = await getObjectRange(storageConfigFromEnv(), {
    key: storageKey,
    start: 0,
    end: length - 1,
  });
  return body;
}

/**
 * Point a `delivery` file row at an already-deliverable master.
 *
 * No bytes are copied. §5.2 wants master and delivery to be distinct records
 * because they carry different rights and different lifecycles, but when the
 * uploaded file is itself web-ready the two records legitimately address the
 * same object. Duplicating the storage to satisfy the model would double the
 * bill for every museum that exports glTF correctly.
 */
async function ensureDeliveryFile(
  tx: Prisma.TransactionClient,
  representationId: string,
  source: SourceFile,
): Promise<void> {
  if (source.purpose === "delivery") return;

  const existing = await tx.heritageRepresentationFile.findFirst({
    where: { representationId, purpose: "delivery", storageKey: source.storageKey },
    select: { id: true },
  });
  if (existing) return;

  await tx.heritageRepresentationFile.create({
    data: {
      representationId,
      purpose: "delivery",
      storageKey: source.storageKey,
      url: source.url,
      format: source.format,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
    },
  });
}
