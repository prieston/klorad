"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { ArrowLeft, FileUp, Loader2, UploadCloud, X } from "lucide-react";
import {
  ACCEPTED_EXTENSIONS,
  KIND_PLAIN,
  archivalOnlyReason,
  inferKind,
} from "@/lib/heritage/ingest";
import { slugify } from "@/lib/heritage/slug";
import {
  uploadRepresentationFile,
  type UploadProgress,
} from "@/lib/heritage/upload-client";
import { PageHeader } from "@/lib/heritage/ui/page-header";

type Kind = keyof typeof ACCEPTED_EXTENSIONS;

/** Everything the uploader will take, so the file picker does not filter out a
 *  format the platform actually accepts. */
const ALL_ACCEPTED = [
  ...new Set(Object.values(ACCEPTED_EXTENSIONS).flat()),
]
  .map((e) => `.${e}`)
  .join(",");

export function NewItemForm({
  orgId,
  venueId,
  defaultLanguage,
  storageConfigured,
  places,
}: {
  orgId: string;
  venueId: string;
  defaultLanguage: string;
  storageConfigured: boolean;
  places: { id: string; label: string }[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/org/${orgId}/venues/${venueId}`;

  function take(picked: File | undefined) {
    if (!picked) return;
    const guessed = inferKind(picked.name);
    if (!guessed) {
      toast.error(
        `Klorad does not accept ${picked.name.split(".").pop()?.toUpperCase() ?? "that"} files.`,
      );
      return;
    }
    setFile(picked);
    setKind(guessed);
    // Pre-fill the name from the filename, tidied. A curator who is happy with
    // it types nothing; one who is not is editing rather than composing, which
    // is a much smaller ask.
    if (!name) {
      const stem = picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      setName(stem.charAt(0).toUpperCase() + stem.slice(1));
    }
  }

  const archivalWarning =
    file && kind ? archivalOnlyReason(kind, file.name) : null;

  async function submit() {
    const title = name.trim();
    if (!title) {
      toast.error("Give the item a name.");
      return;
    }

    setBusy(true);
    try {
      // 1. The record. Created first because the upload attaches to it, which
      //    is what lets the capture inherit the item's rights immediately
      //    rather than resolving to "in copyright" until someone joins them.
      const res = await fetch(`/api/venues/${venueId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugify(title),
          title: { [defaultLanguage]: title },
          spaceId: placeId || null,
        }),
      });
      const created = (await res.json().catch(() => ({}))) as {
        object?: { id: string };
        id?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(created.error ?? "Could not create the item.");
        return;
      }
      const objectId = created.object?.id ?? created.id;
      if (!objectId) {
        toast.error("The item was created but its id was not returned.");
        return;
      }

      // 2. The file, if there is one. An item without a file is legitimate —
      //    a record catalogued ahead of the scanning — so this is skippable
      //    rather than required.
      if (file && kind) {
        const result = await uploadRepresentationFile({
          venueId,
          file,
          kind,
          objectId,
          onProgress: setProgress,
          onArchivalNotice: (reason) =>
            toast.warning(reason, { autoClose: 12_000 }),
        });
        if (result.deliverable) {
          toast.success("Added. Visitors can see it once you publish.");
        } else {
          toast.info(
            result.note ?? "Added. The file is stored but is not viewable in this format.",
          );
        }
      } else {
        toast.success("Item created. Add a file whenever you have one.");
      }

      router.push(`${base}/items`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 md:px-10">
      <Link
        href={`${base}/items`}
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={13} strokeWidth={1.8} aria-hidden />
        Items
      </Link>

      <PageHeader
        title="Add an item."
        lede="Start with the file. Everything else can be filled in later, and most of it can be left alone entirely."
      />

      {/* Step 1 — the file. Deliberately first and deliberately largest: it is
          the thing the curator actually has in their hand. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line-soft bg-surface-1"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-between gap-4 text-left">
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">{file.name}</p>
              <p className="mt-1 text-xs text-text-tertiary">
                {kind ? KIND_PLAIN[kind] : "Unknown"} ·{" "}
                {(file.size / 1024 ** 2).toFixed(1)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setKind(null);
              }}
              disabled={busy}
              aria-label="Remove this file"
              className="shrink-0 rounded-full p-1.5 text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary disabled:opacity-50"
            >
              <X size={15} strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud
              size={26}
              strokeWidth={1.4}
              aria-hidden
              className="mx-auto text-text-tertiary"
            />
            <p className="mt-3 text-sm text-text-primary">
              Drop a 3D model, photo, video or audio file
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              .glb works best for 3D. Large files upload in the background and
              resume if you close the tab.
            </p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!storageConfigured || busy}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-xs text-text-secondary transition hover:bg-surface-2 disabled:opacity-50"
            >
              <FileUp size={13} strokeWidth={1.8} aria-hidden />
              Choose a file
            </button>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ALL_ACCEPTED}
          hidden
          onChange={(e) => take(e.target.files?.[0])}
        />
      </div>

      {archivalWarning ? (
        <p className="mt-3 rounded-xl bg-amber-500/[0.08] px-4 py-3 text-xs leading-relaxed text-amber-700">
          {archivalWarning}
        </p>
      ) : null}

      {/* Step 2 — the name, and nothing else that is not required. Every other
          field on the item lives on its own page and can wait. Asking for
          twelve fields before the first save is how a curator decides to do
          this later. */}
      <label className="mt-8 block">
        <span className="mb-1.5 block text-sm text-text-primary">
          What is it called?
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          placeholder="Marble kore"
          className="w-full rounded-md border border-line-strong bg-bg px-3 py-2.5 text-text-primary outline-none transition focus:border-accent disabled:opacity-50"
        />
        <span className="mt-1.5 block text-xs text-text-tertiary">
          In {defaultLanguage}. Other languages are added on the Translations
          page.
        </span>
      </label>

      {places.length > 0 ? (
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm text-text-primary">
            Where is it? <span className="text-text-tertiary">Optional</span>
          </span>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2.5 text-text-primary disabled:opacity-50"
          >
            <option value="">Not specified</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {progress ? (
        <div className="mt-6">
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${Math.round((progress.uploadedBytes / progress.totalBytes) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Uploading — {Math.round((progress.uploadedBytes / progress.totalBytes) * 100)}%.
            You can leave this page; it will resume.
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} strokeWidth={1.8} aria-hidden className="animate-spin" />
          ) : null}
          {busy ? "Adding" : "Add item"}
        </button>
        <Link
          href={`${base}/items`}
          className="text-sm text-text-tertiary hover:text-text-primary"
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
