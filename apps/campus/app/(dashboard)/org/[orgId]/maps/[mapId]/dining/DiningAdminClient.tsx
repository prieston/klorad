"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import { Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
  Textarea,
} from "@klorad/design-system";
import { uploadFile } from "@klorad/storage/client";
import { type DiningLocation } from "@/lib/dining-db";

interface Props {
  mapId: string;
  initialLocations: DiningLocation[];
}

/**
 * Admin client for /dining. List on the left (delete-only for
 * Arc 5), create form on the right. No live preview — dining
 * cards are simple enough to author blind. Reuses the
 * `campus-news` Spaces prefix for images.
 */
export function DiningAdminClient({ mapId, initialLocations }: Props) {
  const [locations, setLocations] = useState<DiningLocation[]>(initialLocations);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hoursText, setHoursText] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [anchorName, setAnchorName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImage = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadFile(file, { prefix: "campus-news" });
      setImageUrl(result.publicUrl);
    } catch (e) {
      console.error(e);
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setName("");
    setDescription("");
    setHoursText("");
    setCuisine("");
    setMenuUrl("");
    setAnchorName("");
    setImageUrl(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/dining`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          hoursText: hoursText.trim() || undefined,
          cuisine: cuisine.trim() || undefined,
          menuUrl: menuUrl.trim() || undefined,
          imageUrl,
          anchors: anchorName.trim()
            ? [
                {
                  kind: "building",
                  refId: "",
                  refName: anchorName.trim(),
                },
              ]
            : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to publish");
      }
      const list = await fetch(`/api/maps/${mapId}/dining`).then((r) =>
        r.json(),
      );
      setLocations(list.locations ?? []);
      reset();
      toast.success("Location published");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    try {
      const res = await fetch(`/api/dining/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setLocations((l) => l.filter((loc) => loc.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          All locations
        </h2>
        <p className="mt-1 text-xs text-text-tertiary">
          {locations.length} location{locations.length === 1 ? "" : "s"}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {locations.length === 0 ? (
            <p className="rounded-lg bg-surface-2 p-4 text-sm text-text-tertiary">
              No dining yet. Use the form to publish the first one.
            </p>
          ) : (
            locations.map((l) => (
              <article
                key={l.id}
                className="flex gap-3 rounded-lg border border-solid border-line-soft p-3"
              >
                {l.imageUrl ? (
                  <Image
                    src={l.imageUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-text-primary">
                        {l.name}
                      </h3>
                      <p className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-text-tertiary">
                        {l.cuisine ?? "—"}
                        {l.hoursText ? ` · ${l.hoursText}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDelete(l.id)}
                      aria-label="Delete"
                      className="shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-600"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                    {l.description}
                  </p>
                  {l.anchors.length > 0 ? (
                    <p className="mt-1 text-[0.7rem] text-text-tertiary">
                      · {l.anchors.map((a) => a.refName).join(", ")}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          New location
        </h2>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cafe Pavilion"
              required
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quick-service cafe with sandwiches, coffee, and bowls."
              rows={3}
              required
            />
          </Field>

          <Field label="Hours (free text)">
            <Input
              value={hoursText}
              onChange={(e) => setHoursText(e.target.value)}
              placeholder="Mon-Fri 7am-10pm · Sat 9am-3pm · Sun closed"
            />
          </Field>

          <Field label="Cuisine (free text)">
            <Input
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="Salads, sandwiches, coffee"
            />
          </Field>

          <Field label="Menu URL (optional)">
            <Input
              type="url"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Where on campus (optional)">
            <Input
              value={anchorName}
              onChange={(e) => setAnchorName(e.target.value)}
              placeholder="Cafe Pavilion, Marketplace…"
            />
          </Field>

          <Field label="Image (optional)">
            {imageUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-solid border-line-soft p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="ml-auto flex items-center gap-1 rounded-md p-1 text-text-tertiary hover:bg-surface-2 hover:text-red-600"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-soft px-3 py-2 text-sm text-text-tertiary transition-colors hover:border-accent hover:text-accent">
                <Plus size={16} strokeWidth={1.75} />
                {uploading ? "Uploading…" : "Add image"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={reset}
              disabled={submitting}
            >
              Reset
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
