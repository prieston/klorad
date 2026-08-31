"use client";

/**
 * Browser-side resumable uploader.
 *
 * The bytes never pass through the Next server: each part goes straight to
 * object storage on a presigned URL, and only the part's ETag comes back here
 * to be recorded. That is what makes a 26 GB master feasible at all — a
 * serverless function has neither the duration nor the memory to proxy it.
 *
 * Resumability is server-side by design (see HeritageUploadSession). The
 * client asks which parts are already accepted and skips them, so closing the
 * tab mid-upload costs the in-flight parts and nothing more.
 */

export interface UploadProgress {
  uploadedParts: number;
  partCount: number;
  uploadedBytes: number;
  totalBytes: number;
  /** 0–1. */
  fraction: number;
}

export interface StartUploadOptions {
  venueId: string;
  file: File;
  kind:
    | "mesh"
    | "splat"
    | "point_cloud"
    | "image"
    | "audio"
    | "video"
    | "panorama";
  purpose?: "master" | "delivery" | "tileset" | "lod" | "thumbnail" | "transcript" | "caption";
  representationId?: string | null;
  objectId?: string | null;
  spaceId?: string | null;
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
  /**
   * Parts uploaded in parallel. Four is a deliberate middle: enough to
   * saturate a normal connection, few enough that a museum's shared uplink
   * does not collapse and that a failure retries cheaply.
   */
  concurrency?: number;
  /** Resume an existing session instead of starting a new one. */
  resumeSessionId?: string;
}

export interface UploadResult {
  sessionId: string;
  representationId: string;
  jobId: string;
  estimatedSeconds: number | null;
  url: string;
  note?: string;
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export async function uploadRepresentationFile(
  opts: StartUploadOptions,
): Promise<UploadResult> {
  const {
    venueId,
    file,
    kind,
    purpose = "master",
    representationId = null,
    objectId = null,
    spaceId = null,
    onProgress,
    signal,
    concurrency = 4,
    resumeSessionId,
  } = opts;

  const base = `/api/venues/${venueId}/uploads`;

  // 1. Open or reopen a session.
  let sessionId: string;
  let partSize: number;
  let partCount: number;
  let todo: number[];

  if (resumeSessionId) {
    const state = await json<{
      session: { partSize: number; partCount: number; fileName: string };
      remainingParts: number[];
    }>(await fetch(`${base}/${resumeSessionId}`, { signal }));
    if (state.session.fileName !== file.name) {
      throw new Error(
        `This session was started for "${state.session.fileName}". Choose that file to resume, or start a new upload.`,
      );
    }
    sessionId = resumeSessionId;
    partSize = state.session.partSize;
    partCount = state.session.partCount;
    todo = state.remainingParts;
  } else {
    const started = await json<{
      sessionId: string;
      partSize: number;
      partCount: number;
    }>(
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          kind,
          purpose,
          representationId,
        }),
      }),
    );
    sessionId = started.sessionId;
    partSize = started.partSize;
    partCount = started.partCount;
    todo = Array.from({ length: partCount }, (_, i) => i + 1);
  }

  // Parts already accepted count toward progress from the first tick, so a
  // resumed upload does not appear to restart at zero.
  let doneParts = partCount - todo.length;
  let doneBytes = doneParts * partSize;
  const report = () =>
    onProgress?.({
      uploadedParts: doneParts,
      partCount,
      uploadedBytes: Math.min(doneBytes, file.size),
      totalBytes: file.size,
      fraction: partCount === 0 ? 1 : doneParts / partCount,
    });
  report();

  // 2. Push the outstanding parts, `concurrency` at a time.
  const queue = [...todo];
  const worker = async () => {
    for (;;) {
      const partNumber = queue.shift();
      if (partNumber === undefined) return;
      if (signal?.aborted) throw new Error("Upload cancelled");

      const start = (partNumber - 1) * partSize;
      const blob = file.slice(start, Math.min(start + partSize, file.size));

      const { url } = await json<{ url: string }>(
        await fetch(`${base}/${sessionId}/parts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({ partNumber }),
        }),
      );

      const put = await fetch(url, { method: "PUT", body: blob, signal });
      if (!put.ok) {
        throw new Error(`Part ${partNumber} failed to upload (${put.status})`);
      }
      // Readable only because the bucket's CORS exposes ETag — see
      // packages/storage/scripts/set-cors.ts. Without it this is null and the
      // upload cannot be completed.
      const eTag = put.headers.get("ETag");
      if (!eTag) {
        throw new Error(
          "Storage did not return an ETag for this part. The bucket's CORS policy must expose the ETag header — run `pnpm spaces:set-cors`.",
        );
      }

      await json(
        await fetch(`${base}/${sessionId}/parts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({ partNumber, eTag, sizeBytes: blob.size }),
        }),
      );

      doneParts += 1;
      doneBytes += blob.size;
      report();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, worker),
  );

  // 3. Assemble and register.
  const done = await json<UploadResult>(
    await fetch(`${base}/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ kind, objectId, spaceId }),
    }),
  );
  return { ...done, sessionId };
}

/** Cancel an upload and reclaim its parts at the provider. */
export async function abortUpload(
  venueId: string,
  sessionId: string,
): Promise<void> {
  await fetch(`/api/venues/${venueId}/uploads/${sessionId}`, {
    method: "DELETE",
  });
}
