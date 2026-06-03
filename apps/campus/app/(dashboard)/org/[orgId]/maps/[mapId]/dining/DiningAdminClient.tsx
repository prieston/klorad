"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "@klorad/design-system";
import { UPLOAD_PREFIXES } from "@/lib/uploads/prefixes";
import { ImagePicker } from "@/app/(dashboard)/components/ImagePicker";
import { type DiningLocation } from "@/lib/dining-db";
import { type HoursShift, type Weekday } from "@/lib/dining-hours";
import { AnchorPicker, type AnchorValue } from "@/lib/admin/AnchorPicker";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

/**
 * Hours editor — row per shift, add/remove rows, pick the weekday
 * and type open + close (`HH:mm`). Native `<input type="time">` gives
 * us free validation and a sane keyboard / dial UI on every browser;
 * we don't try to be clever about preventing overlapping shifts,
 * since "lunch + dinner" overlap is actually legitimate.
 */
function HoursEditor({
  value,
  onChange,
}: {
  value: HoursShift[];
  onChange: (next: HoursShift[]) => void;
}) {
  const sorted = [...value].sort(
    (a, b) => a.day - b.day || a.open.localeCompare(b.open),
  );

  const addRow = () => {
    // Default to "Mon 09:00 - 17:00" if no existing rows, otherwise
    // clone the day of the last row so the rector can quickly add a
    // second shift (Mon lunch, Mon dinner).
    const last = sorted[sorted.length - 1];
    const next: HoursShift = {
      day: last ? last.day : 1,
      open: "09:00",
      close: "17:00",
    };
    onChange([...value, next]);
  };

  const update = (idx: number, patch: Partial<HoursShift>) => {
    const copy = [...value];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  const remove = (idx: number) => {
    const copy = [...value];
    copy.splice(idx, 1);
    onChange(copy);
  };

  if (sorted.length === 0) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-4 text-xs text-text-tertiary">
          No structured hours yet. The public site will fall back to the
          caveat below.
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={addRow}
        >
          <Plus size={12} strokeWidth={1.75} aria-hidden />
          Add shift
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {value.map((shift, idx) => (
          <li
            key={idx}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-surface-2/30 p-2"
          >
            <Select
              value={String(shift.day)}
              onChange={(e) =>
                update(idx, { day: Number(e.target.value) as Weekday })
              }
              className="w-[88px]"
            >
              {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_LABELS[d]}
                </option>
              ))}
            </Select>
            <input
              type="time"
              value={shift.open}
              onChange={(e) => update(idx, { open: e.target.value })}
              className="h-9 w-[96px] rounded-md border border-line-strong bg-surface-1 px-2 text-sm text-text-primary outline-none focus:border-accent"
              aria-label="Opens at"
            />
            <span aria-hidden className="text-xs text-text-tertiary">
              &mdash;
            </span>
            <input
              type="time"
              value={shift.close}
              onChange={(e) => update(idx, { close: e.target.value })}
              className="h-9 w-[96px] rounded-md border border-line-strong bg-surface-1 px-2 text-sm text-text-primary outline-none focus:border-accent"
              aria-label="Closes at"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label="Remove shift"
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-500"
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={addRow}
      >
        <Plus size={12} strokeWidth={1.75} aria-hidden />
        Add shift
      </Button>
    </div>
  );
}

interface Props {
  mapId: string;
  initialLocations: DiningLocation[];
  /** MappedIn venue id — when set, the anchor input becomes a picker. */
  indoorMapId?: string | null;
}

const EMPTY_ANCHOR: AnchorValue = { refName: "", refId: "" };

/**
 * Admin client for /dining. List on the left (delete-only for
 * Arc 5), create form on the right. No live preview — dining
 * cards are simple enough to author blind. Reuses the
 * `campus-news` Spaces prefix for images.
 */
export function DiningAdminClient({
  mapId,
  initialLocations,
  indoorMapId,
}: Props) {
  const [locations, setLocations] = useState<DiningLocation[]>(initialLocations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameEl, setNameEl] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEl, setDescriptionEl] = useState("");
  const [hoursText, setHoursText] = useState("");
  const [hours, setHours] = useState<HoursShift[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [anchor, setAnchor] = useState<AnchorValue>(EMPTY_ANCHOR);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEditingId(null);
    setName("");
    setNameEl("");
    setDescription("");
    setDescriptionEl("");
    setHoursText("");
    setHours([]);
    setCuisine("");
    setMenuUrl("");
    setAnchor(EMPTY_ANCHOR);
    setImageUrl(null);
  };

  const startEdit = (location: DiningLocation) => {
    setEditingId(location.id);
    setName(location.name);
    setNameEl(location.nameEl ?? "");
    setDescription(location.description);
    setDescriptionEl(location.descriptionEl ?? "");
    setHoursText(location.hoursText ?? "");
    setHours(location.hours);
    setCuisine(location.cuisine ?? "");
    setMenuUrl(location.menuUrl ?? "");
    setAnchor(
      location.anchors[0]
        ? {
            refName: location.anchors[0].refName,
            refId: location.anchors[0].refId,
          }
        : EMPTY_ANCHOR,
    );
    setImageUrl(location.imageUrl);
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
        ? `/api/dining/${editingId}`
        : `/api/maps/${mapId}/dining`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameEl: nameEl.trim() || "",
          description: description.trim(),
          descriptionEl: descriptionEl.trim() || "",
          hoursText: hoursText.trim() || undefined,
          hours,
          cuisine: cuisine.trim() || undefined,
          menuUrl: menuUrl.trim() || undefined,
          imageUrl,
          anchors: anchor.refName.trim()
            ? [
                {
                  kind: "building",
                  refId: anchor.refId,
                  refName: anchor.refName.trim(),
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
      toast.success(editingId ? "Updated" : "Location published");
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
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(l)}
                        aria-label="Edit"
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-accent"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(l.id)}
                        aria-label="Delete"
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-600"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">
            {editingId ? "Edit location" : "New location"}
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
              placeholder="Cafe Pavilion"
              required
            />
          </Field>

          <Field label="Name (Greek, optional)">
            <Input
              value={nameEl}
              onChange={(e) => setNameEl(e.target.value)}
              placeholder="Παβιγιόν καφέ"
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

          <Field label="Description (Greek, optional)">
            <Textarea
              value={descriptionEl}
              onChange={(e) => setDescriptionEl(e.target.value)}
              placeholder="Καφετέρια με σάντουιτς, καφέ και μπολ."
              rows={3}
            />
          </Field>

          <Field
            label="Hours"
            hint="Add a shift per opening — split shifts (lunch + dinner) are separate rows on the same day. Used to compute the live Open now badge."
          >
            <HoursEditor value={hours} onChange={setHours} />
          </Field>

          <Field
            label="Hours caveat (free text, optional)"
            hint="Shows alongside the structured hours. Use for one-off notes: 'Closed for finals week', 'Patio seasonal'."
          >
            <Input
              value={hoursText}
              onChange={(e) => setHoursText(e.target.value)}
              placeholder="Closed for finals week"
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
            <AnchorPicker
              indoorMapId={indoorMapId}
              value={anchor}
              onChange={setAnchor}
              placeholder="Cafe Pavilion, Marketplace…"
              ariaLabel="Anchor"
            />
          </Field>

          <Field
            label="Image (optional)"
            hint="Pick a stock cover or upload your own."
          >
            <ImagePicker
              value={imageUrl}
              onChange={setImageUrl}
              uploadPrefix={UPLOAD_PREFIXES.dining}
              defaultCategory="dining"
            />
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
