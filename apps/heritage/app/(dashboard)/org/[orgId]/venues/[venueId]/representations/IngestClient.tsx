"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Clock,
  FileUp,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import {
  abortUpload,
  uploadRepresentationFile,
  type UploadProgress,
} from "@/lib/heritage/upload-client";
import { ACCEPTED_EXTENSIONS } from "@/lib/heritage/ingest";

type Kind = keyof typeof ACCEPTED_EXTENSIONS;

interface FileRow {
  id: string;
  purpose: string;
  format: string;
  sizeBytes: string | null;
  url: string | null;
}

interface JobRow {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  estimatedSeconds: number | null;
  failureReason: string | null;
}

interface RepRow {
  id: string;
  kind: string;
  status: string;
  state: string;
  label: string | null;
  attachedTo: string | null;
  failureReason: string | null;
  createdAt: string;
  /** A delivery file exists and has a URL — the thing that decides whether a
   *  visitor sees this, independent of whether processing succeeded. */
  deliverable: boolean;
  triangleCount: number | null;
  widthPx: number | null;
  heightPx: number | null;
  files: FileRow[];
  job: JobRow | null;
}

interface SessionRow {
  id: string;
  fileName: string;
  sizeBytes: string;
  partCount: number;
  uploadedParts: number;
  status: string;
  expiresAt: string;
}

function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function humanDuration(seconds: number | null): string {
  if (!seconds) return "";
  if (seconds < 90) return `~${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 90) return `~${m} min`;
  return `~${(m / 60).toFixed(1)} h`;
}

const KIND_LABEL: Record<Kind, string> = {
  splat: "Gaussian splat capture",
  mesh: "Mesh",
  point_cloud: "Point cloud",
  image: "Image",
  audio: "Audio",
  video: "Video",
  panorama: "Panorama",
};

export function IngestClient({
  venueId,
  storageConfigured,
  initialRepresentations,
  initialSessions,
}: {
  venueId: string;
  storageConfigured: boolean;
  initialRepresentations: RepRow[];
  initialSessions: SessionRow[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [kind, setKind] = useState<Kind>("mesh");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  const accept = ACCEPTED_EXTENSIONS[kind].map((e) => `.${e}`).join(",");

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusyName(file.name);
    setProgress(null);
    try {
      const result = await uploadRepresentationFile({
        venueId,
        file,
        kind,
        onProgress: setProgress,
        signal: controller.signal,
        // Fires before the transfer starts, so this warning arrives while
        // cancelling is still free.
        onArchivalNotice: (reason) => toast.warning(reason, { autoClose: 12_000 }),
      });

      // Processing runs inline, so by here the outcome is known. Three
      // genuinely different results, reported as three different things
      // rather than flattened into one cheerful "uploaded".
      if (result.deliverable) {
        toast.success("Uploaded and published. Visitors can see this now.");
      } else if (result.status === "failed") {
        toast.error(result.note ?? "Uploaded, but processing failed.");
      } else {
        toast.info(
          result.note ??
            "Uploaded and stored. It is not viewable in this format — see the note on the row.",
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyName(null);
      setProgress(null);
      abortRef.current = null;
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const cancel = () => abortRef.current?.abort();

  const discardSession = async (id: string) => {
    await abortUpload(venueId, id);
    toast.info("Upload discarded");
    router.refresh();
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Ingest.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary">
          Upload the capture your contractor produced. Large files upload in
          parts and resume where they left off, so a dropped connection costs
          minutes rather than the whole transfer.
        </p>
      </header>

      {!storageConfigured && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
          <AlertTriangle
            size={18}
            strokeWidth={1.7}
            aria-hidden
            className="mt-0.5 shrink-0 text-amber-600"
          />
          <div className="text-sm">
            <p className="font-medium text-text-primary">
              Object storage is not configured
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Set the <code className="font-mono">DO_SPACES_*</code> variables
              and restart. Point them at an EU region — data residency is a
              tender requirement, not a preference.
            </p>
          </div>
        </div>
      )}

      <section className="mb-10 rounded-2xl border border-line-soft bg-bg p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-text-tertiary">
              What is this file?
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              disabled={!!busyName}
              className="rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary disabled:opacity-50"
            >
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={!storageConfigured || !!busyName}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Upload size={15} strokeWidth={1.8} aria-hidden />
            Choose file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
        </div>
        <p className="mt-3 text-xs text-text-tertiary">
          Accepted: {ACCEPTED_EXTENSIONS[kind].map((e) => `.${e}`).join(", ")}
          {kind === "splat" || kind === "mesh" ? (
            <>
              {" "}· <code className="font-mono">.ply</code> is both a splat
              master and a mesh format, so the kind you pick above decides which
              pipeline runs.
            </>
          ) : null}
        </p>

        {busyName && (
          <div className="mt-6 rounded-xl bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
                <Loader2
                  size={14}
                  strokeWidth={1.8}
                  aria-hidden
                  className="shrink-0 animate-spin text-accent"
                />
                <span className="truncate font-mono text-xs">{busyName}</span>
              </span>
              <button
                type="button"
                onClick={cancel}
                className="shrink-0 text-xs text-text-tertiary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
            {progress && (
              <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-1">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-text-tertiary">
                  {humanBytes(progress.uploadedBytes)} of{" "}
                  {humanBytes(progress.totalBytes)} · part{" "}
                  {progress.uploadedParts} of {progress.partCount}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {initialSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            <FileUp size={12} strokeWidth={1.8} aria-hidden />
            Unfinished uploads
          </h2>
          <ul className="divide-y divide-line-soft">
            {initialSessions.map((s) => (
              <li key={s.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-text-primary">
                    {s.fileName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {s.uploadedParts} of {s.partCount} parts ·{" "}
                    {humanBytes(Number(s.sizeBytes))} · expires{" "}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void discardSession(s.id)}
                  aria-label={`Discard ${s.fileName}`}
                  className="shrink-0 rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-text-primary"
                >
                  <X size={13} strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-text-tertiary">
            Re-selecting the same file resumes from the last accepted part.
            Discarding releases the uploaded parts — storage providers bill for
            them until then.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          Representations
          {initialRepresentations.length > 0 ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] tracking-normal text-accent">
              {initialRepresentations.length}
            </span>
          ) : null}
        </h2>
        {initialRepresentations.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            Nothing ingested yet.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {initialRepresentations.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">
                      {r.label ?? r.files[0]?.format?.toUpperCase() ?? r.kind}
                      {r.attachedTo ? (
                        <span className="text-text-tertiary"> · {r.attachedTo}</span>
                      ) : (
                        <span className="text-amber-600"> · not attached to an object</span>
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5">
                        {r.kind}
                      </span>
                      {r.files
                        .filter((f) => f.purpose !== "delivery" || r.files.length === 1)
                        .map((f) => (
                          <span key={f.id}>
                            {f.purpose} · .{f.format} ·{" "}
                            {humanBytes(Number(f.sizeBytes ?? 0))}
                          </span>
                        ))}
                      {r.triangleCount ? (
                        <span>{r.triangleCount.toLocaleString()} triangles</span>
                      ) : null}
                      {r.widthPx && r.heightPx ? (
                        <span>
                          {r.widthPx.toLocaleString()} × {r.heightPx.toLocaleString()}
                        </span>
                      ) : null}
                      {r.status === "ready" && !r.deliverable ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700">
                          archival only
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill rep={r} />
                    {!r.deliverable && r.files.length > 0 ? (
                      <ReprocessButton venueId={venueId} representationId={r.id} />
                    ) : null}
                  </div>
                </div>
                {(r.failureReason || r.job?.failureReason) && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle
                      size={12}
                      strokeWidth={1.8}
                      aria-hidden
                      className="mt-0.5 shrink-0"
                    />
                    {r.failureReason ?? r.job?.failureReason}
                    {r.job && r.job.attempts > 0 ? (
                      <span className="text-text-tertiary">
                        {" "}
                        (attempt {r.job.attempts})
                      </span>
                    ) : null}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-text-tertiary">
        <RotateCcw size={13} strokeWidth={1.7} aria-hidden className="mt-px shrink-0" />
        <span>
          Web-ready formats — .glb, .gltf, JPEG, PNG, WebP, MP3, MP4 — are
          validated, measured and published as soon as the upload finishes.
          Anything else is kept as an archival master and marked as such:
          nothing is discarded, but only formats a browser can open are shown
          to visitors. Re-export as .glb to publish a mesh, then reprocess.
        </span>
      </p>
    </main>
  );
}

function StatusPill({ rep }: { rep: RepRow }) {
  const job = rep.job;
  const failed = rep.status === "failed" || job?.status === "failed";
  const queued = rep.status === "queued" || job?.status === "queued";
  const running = rep.status === "processing" || job?.status === "running";

  if (failed) {
    return (
      <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-red-600">
        Failed
      </span>
    );
  }
  if (running) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-accent">
        <Loader2 size={9} strokeWidth={2} aria-hidden className="animate-spin" />
        Processing
      </span>
    );
  }
  if (queued) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        <Clock size={9} strokeWidth={2} aria-hidden />
        Queued{job?.estimatedSeconds ? ` · ${humanDuration(job.estimatedSeconds)}` : ""}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
      Ready
    </span>
  );
}

/**
 * Re-run the pipeline over a file that is already in storage.
 *
 * Offered on anything not currently deliverable, which covers both halves of
 * the problem: a transient read failure, and an archival master whose format
 * became deliverable after the fact. In neither case should the answer be
 * "upload it again".
 */
function ReprocessButton({
  venueId,
  representationId,
}: {
  venueId: string;
  representationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/venues/${venueId}/representations/${representationId}/reprocess`,
        { method: "POST" },
      );
      const body = (await res.json()) as {
        error?: string;
        deliverable?: boolean;
        note?: string | null;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Reprocessing failed.");
        return;
      }
      if (body.deliverable) {
        toast.success("Processed. This is now visible to visitors.");
      } else {
        // Not an error: the file is stored and intact. Saying "failed" here
        // would misrepresent an archival master as a broken upload.
        toast.info(body.note ?? "Stored as an archival master — not viewable as it stands.");
      }
      router.refresh();
    } catch {
      toast.error("Reprocessing could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-line-soft px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-secondary transition hover:bg-surface-2 disabled:opacity-50"
    >
      {busy ? (
        <Loader2 size={9} strokeWidth={2} aria-hidden className="animate-spin" />
      ) : (
        <RotateCcw size={9} strokeWidth={2} aria-hidden />
      )}
      {busy ? "Working" : "Reprocess"}
    </button>
  );
}
