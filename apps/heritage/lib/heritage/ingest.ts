import type {
  HeritageIngestJobKind,
  HeritageRepresentationKind,
} from "@prisma/client";

/**
 * Ingest rules (§5.4, §7.2.1).
 *
 * "Institutions will arrive with whatever their contractor produced" — so the
 * accepted set is deliberately wide, and deliberately explicit. Anything not
 * listed is rejected at the start of the upload rather than after a curator
 * has spent forty minutes pushing bytes.
 */

/**
 * Extensions accepted per representation kind.
 *
 * Note `ply` appears under both `splat` and `mesh`. That ambiguity is real —
 * a PLY is the archival master for a Gaussian-splat capture *and* a common
 * mesh interchange format — and it is why the curator declares the kind
 * rather than the server sniffing the extension. Guessing here would send a
 * splat master down the mesh pipeline and produce a confidently wrong result.
 */
export const ACCEPTED_EXTENSIONS: Record<
  HeritageRepresentationKind,
  readonly string[]
> = {
  splat: ["ply", "spz", "splat", "ksplat", "sog"],
  mesh: ["gltf", "glb", "obj", "ply", "dae", "wrl", "stl", "fbx"],
  point_cloud: ["e57", "las", "laz", "copc"],
  image: ["jpg", "jpeg", "png", "tif", "tiff", "webp"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "flac"],
  video: ["mp4", "webm", "mov", "m4v"],
  panorama: ["jpg", "jpeg", "png", "webp"],
};

/**
 * Which pipeline a completed upload needs (§7.2.2).
 *
 * Splats normalise to the delivery format, build a level-of-detail tree and
 * tile. Meshes decimate, compress geometry and transcode textures to KTX2.
 * Point clouds convert or get rejected with a reason. Everything else is
 * probed for duration, dimensions and codec.
 */
export const JOB_KIND_FOR: Record<
  HeritageRepresentationKind,
  HeritageIngestJobKind
> = {
  splat: "splat_pipeline",
  mesh: "mesh_pipeline",
  point_cloud: "point_cloud_conversion",
  image: "media_probe",
  audio: "media_probe",
  video: "media_probe",
  panorama: "media_probe",
};

/**
 * Upper bound per file. Well above §5.4's largest planning figure — a 20 to
 * 110 M-splat outdoor site masters at 5 to 26 GB — with headroom for a survey
 * deliverable nobody warned us about. Past this the answer is that the
 * institution splits the capture, not that the platform quietly tries.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 * 1024;

/** How long an unfinished upload session stays resumable before its parts are
 *  reclaimed. Long enough to survive a weekend; storage providers bill for
 *  orphaned parts until they are aborted. */
export const UPLOAD_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Lease window for a claimed ingest job. A worker that has not reported back
 *  within this is treated as dead and the job returns to the queue. */
export const JOB_LEASE_MS = 30 * 60 * 1000;

export function extensionOf(fileName: string): string {
  const clean = fileName.trim().toLowerCase();
  // `.copc.laz` and `.tar.gz` style double extensions: take the last segment,
  // then special-case COPC, whose meaningful marker is the penultimate one.
  const parts = clean.split(".");
  if (parts.length < 2) return "";
  const last = parts[parts.length - 1];
  if (parts.length >= 3 && parts[parts.length - 2] === "copc") return "copc";
  return last;
}

export function isAcceptedFor(
  kind: HeritageRepresentationKind,
  fileName: string,
): boolean {
  return ACCEPTED_EXTENSIONS[kind].includes(extensionOf(fileName));
}

/**
 * Human-readable rejection, for the error a curator actually reads.
 * §7.2.1 asks for "errors a curator can act on" — naming the accepted set is
 * the difference between a dead end and a next step.
 */
export function rejectionReason(
  kind: HeritageRepresentationKind,
  fileName: string,
): string {
  const ext = extensionOf(fileName);
  const accepted = ACCEPTED_EXTENSIONS[kind].join(", ");
  return ext
    ? `.${ext} is not an accepted ${kind.replace("_", " ")} format. Accepted: ${accepted}.`
    : `"${fileName}" has no file extension, so its format cannot be determined. Accepted ${kind.replace("_", " ")} formats: ${accepted}.`;
}

/**
 * A very rough completion estimate, in seconds, shown while a job is queued.
 *
 * Openly a heuristic — throughput depends on the worker, and no worker exists
 * yet to measure. It is here because §7.2's stated principle is that a
 * pipeline taking twenty minutes must say so, and an order-of-magnitude
 * estimate serves a curator better than an unbounded spinner. Replace it with
 * measured throughput once the pipeline runs.
 */
export function estimateProcessingSeconds(
  kind: HeritageRepresentationKind,
  sizeBytes: number,
): number {
  const gb = sizeBytes / (1024 * 1024 * 1024);
  const secondsPerGb: Record<HeritageIngestJobKind, number> = {
    // Splat-tree construction plus tiling is the expensive one.
    splat_pipeline: 900,
    // Decimation, Draco and KTX2 transcode.
    mesh_pipeline: 420,
    // Conversion from survey formats.
    point_cloud_conversion: 600,
    // Reading a header.
    media_probe: 10,
  };
  return Math.max(15, Math.round(gb * secondsPerGb[JOB_KIND_FOR[kind]]));
}

/** Storage prefix for a venue's ingested masters. Keeps one tenant's objects
 *  under one path, which is what makes a per-tenant export (§7.4.6) and a
 *  residency claim (§9.1) something you can actually point at. */
export function storagePrefixFor(venueId: string): string {
  return `heritage/${venueId}/masters`;
}
