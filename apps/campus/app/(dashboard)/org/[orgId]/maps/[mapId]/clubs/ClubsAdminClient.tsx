"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "@klorad/design-system";
import { uploadFile } from "@klorad/storage/client";
import {
  deriveInitials,
  type Club,
  type ClubColor,
} from "@/lib/clubs-db";

interface Props {
  mapId: string;
  initialClubs: Club[];
}

const COLORS: { value: ClubColor; label: string; swatch: string }[] = [
  { value: "purple", label: "Purple", swatch: "#534AB7" },
  { value: "coral", label: "Coral", swatch: "#D85A30" },
  { value: "teal", label: "Teal", swatch: "#1D9E75" },
  { value: "pink", label: "Pink", swatch: "#D4537E" },
];

/**
 * Clubs admin client. List on the left (delete-only for Arc 4), an
 * inline create form on the right. Initials auto-derive from the
 * name unless the admin overrides them. The View button on the
 * public site uses `externalLink`; if it's empty, the club still
 * renders but the button is disabled.
 */
export function ClubsAdminClient({ mapId, initialClubs }: Props) {
  const [clubs, setClubs] = useState<Club[]>(initialClubs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameEl, setNameEl] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEl, setDescriptionEl] = useState("");
  const [initialsOverride, setInitialsOverride] = useState("");
  const [avatarColor, setAvatarColor] = useState<ClubColor>("purple");
  const [memberCount, setMemberCount] = useState("");
  const [meetsCadence, setMeetsCadence] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [popularityScore, setPopularityScore] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previewInitials = (initialsOverride.trim() || deriveInitials(name)).slice(0, 3);

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
    setEditingId(null);
    setName("");
    setNameEl("");
    setDescription("");
    setDescriptionEl("");
    setInitialsOverride("");
    setAvatarColor("purple");
    setMemberCount("");
    setMeetsCadence("");
    setExternalLink("");
    setPopularityScore("");
    setImageUrl(null);
  };

  const startEdit = (club: Club) => {
    setEditingId(club.id);
    setName(club.name);
    setNameEl(club.nameEl ?? "");
    setDescription(club.description);
    setDescriptionEl(club.descriptionEl ?? "");
    setInitialsOverride(club.initials);
    setAvatarColor(club.avatarColor);
    setMemberCount(String(club.memberCount));
    setMeetsCadence(club.meetsCadence ?? "");
    setExternalLink(club.externalLink ?? "");
    setPopularityScore(String(club.popularityScore));
    setImageUrl(club.imageUrl);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editingId
        ? `/api/clubs/${editingId}`
        : `/api/maps/${mapId}/clubs`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameEl: nameEl.trim() || "",
          description: description.trim(),
          descriptionEl: descriptionEl.trim() || "",
          initials: initialsOverride.trim() || undefined,
          avatarColor,
          memberCount: memberCount.trim()
            ? Number.parseInt(memberCount, 10)
            : 0,
          popularityScore: popularityScore.trim()
            ? Number.parseInt(popularityScore, 10)
            : 0,
          meetsCadence: meetsCadence.trim() || undefined,
          externalLink: externalLink.trim() || undefined,
          imageUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
      }
      const list = await fetch(`/api/maps/${mapId}/clubs`).then((r) =>
        r.json(),
      );
      setClubs(list.clubs ?? []);
      reset();
      toast.success(editingId ? "Updated" : "Club published");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this club?")) return;
    try {
      const res = await fetch(`/api/clubs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setClubs((c) => c.filter((club) => club.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          All clubs
        </h2>
        <p className="mt-1 text-xs text-text-tertiary">
          {clubs.length} club{clubs.length === 1 ? "" : "s"}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {clubs.length === 0 ? (
            <p className="rounded-lg bg-surface-2 p-4 text-sm text-text-tertiary">
              No clubs yet. Use the form to publish the first one.
            </p>
          ) : (
            clubs.map((c) => {
              const swatch =
                COLORS.find((co) => co.value === c.avatarColor)?.swatch ??
                "#534AB7";
              return (
                <article
                  key={c.id}
                  className="flex gap-3 rounded-lg border border-solid border-line-soft p-3"
                >
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white"
                      style={{ backgroundColor: swatch }}
                    >
                      {c.initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-text-primary">
                          {c.name}
                        </h3>
                        <p className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-text-tertiary">
                          {c.memberCount} members
                          {c.meetsCadence ? ` · ${c.meetsCadence}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          aria-label="Edit"
                          className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-accent"
                        >
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(c.id)}
                          aria-label="Delete"
                          className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-600"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                      {c.description}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">
            {editingId ? "Edit club" : "New club"}
          </h2>
          {editingId ? (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-text-tertiary transition-colors hover:text-text-primary"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Data science society"
              required
            />
          </Field>

          <Field label="Name (Greek, optional)">
            <Input
              value={nameEl}
              onChange={(e) => setNameEl(e.target.value)}
              placeholder="Όμιλος επιστήμης δεδομένων"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the club does."
              rows={4}
              required
            />
          </Field>

          <Field label="Description (Greek, optional)">
            <Textarea
              value={descriptionEl}
              onChange={(e) => setDescriptionEl(e.target.value)}
              placeholder="Τι κάνει ο όμιλος."
              rows={4}
            />
          </Field>

          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium text-white"
              style={{
                backgroundColor:
                  COLORS.find((c) => c.value === avatarColor)?.swatch ??
                  "#534AB7",
              }}
            >
              {previewInitials}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Initials (auto)">
                <Input
                  value={initialsOverride}
                  onChange={(e) => setInitialsOverride(e.target.value)}
                  placeholder={deriveInitials(name) || "DS"}
                  maxLength={3}
                />
              </Field>
              <Field label="Avatar colour">
                <Select
                  value={avatarColor}
                  onChange={(e) =>
                    setAvatarColor(e.target.value as ClubColor)
                  }
                >
                  {COLORS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Members">
              <Input
                type="number"
                min="0"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                placeholder="248"
              />
            </Field>
            <Field label="Activity rank">
              <Input
                type="number"
                value={popularityScore}
                onChange={(e) => setPopularityScore(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Meets">
            <Input
              value={meetsCadence}
              onChange={(e) => setMeetsCadence(e.target.value)}
              placeholder="Meets Wednesdays at 6 pm"
            />
          </Field>

          <Field label="External link (Discord, Insta, group chat)">
            <Input
              type="url"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://…"
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
              {submitting
                ? editingId
                  ? "Saving…"
                  : "Publishing…"
                : editingId
                  ? "Save changes"
                  : "Publish"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
