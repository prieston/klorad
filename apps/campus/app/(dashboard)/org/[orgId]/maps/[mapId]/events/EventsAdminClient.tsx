"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  formatEventWhen,
  type EventPost,
  type EventBanner,
  type EventIcon,
} from "@/lib/events-db";
import { AnchorPicker, type AnchorValue } from "@/lib/admin/AnchorPicker";

interface Props {
  mapId: string;
  initialEvents: EventPost[];
  /** MappedIn venue id — when set, the anchor input becomes a picker. */
  indoorMapId?: string | null;
  /** True when VAPID keys are configured on the server. Drives whether
   *  the "Send push notification" switch is interactive. */
  pushEnabled?: boolean;
}

const EMPTY_ANCHOR: AnchorValue = { refName: "", refId: "" };

const BANNERS: { value: EventBanner; label: string; swatch: string }[] = [
  { value: "purple", label: "Purple", swatch: "#534AB7" },
  { value: "coral", label: "Coral", swatch: "#D85A30" },
  { value: "teal", label: "Teal", swatch: "#1D9E75" },
  { value: "pink", label: "Pink", swatch: "#D4537E" },
];

const ICONS: { value: EventIcon; label: string }[] = [
  { value: "calendar", label: "Calendar" },
  { value: "music", label: "Music" },
  { value: "trophy", label: "Trophy" },
  { value: "sprout", label: "Sprout" },
];

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in local time. */
function plusHoursLocal(hours: number): string {
  const d = new Date(Date.now() + hours * 3_600_000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/**
 * Events admin client. List + delete on the left; create form on the
 * right (title · description · start / end · banner colour + icon ·
 * anchor name · optional image / registration URL / organizer /
 * expected attendance). POST goes to /api/maps/[mapId]/events; the
 * server bumps the public cache tag so the rail updates instantly.
 */
export function EventsAdminClient({
  mapId,
  initialEvents,
  indoorMapId,
  pushEnabled = false,
}: Props) {
  const [events, setEvents] = useState<EventPost[]>(initialEvents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleEl, setTitleEl] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEl, setDescriptionEl] = useState("");
  const [startsAt, setStartsAt] = useState(plusHoursLocal(24));
  const [endsAt, setEndsAt] = useState(plusHoursLocal(26));
  const [bannerColor, setBannerColor] = useState<EventBanner>("purple");
  const [bannerIcon, setBannerIcon] = useState<EventIcon>("calendar");
  const [anchor, setAnchor] = useState<AnchorValue>(EMPTY_ANCHOR);
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [expectedAttendance, setExpectedAttendance] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Only meaningful on Create — see NewsAdminClient for the same
   *  no-resend-on-edit rationale. */
  const [notify, setNotify] = useState(false);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setTitleEl("");
    setDescription("");
    setDescriptionEl("");
    setStartsAt(plusHoursLocal(24));
    setEndsAt(plusHoursLocal(26));
    setBannerColor("purple");
    setBannerIcon("calendar");
    setAnchor(EMPTY_ANCHOR);
    setRegistrationUrl("");
    setOrganizer("");
    setExpectedAttendance("");
    setImageUrl(null);
    setNotify(false);
  };

  /** `<input type="datetime-local">` value from an ISO string in local TZ. */
  const isoToLocal = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
  };

  const startEdit = (event: EventPost) => {
    setEditingId(event.id);
    setTitle(event.title);
    setTitleEl(event.titleEl ?? "");
    setDescription(event.description);
    setDescriptionEl(event.descriptionEl ?? "");
    setStartsAt(isoToLocal(event.startsAt));
    setEndsAt(isoToLocal(event.endsAt));
    setBannerColor(event.bannerColor);
    setBannerIcon(event.bannerIcon);
    setAnchor(
      event.anchors[0]
        ? { refName: event.anchors[0].refName, refId: event.anchors[0].refId }
        : EMPTY_ANCHOR,
    );
    setRegistrationUrl(event.registrationUrl ?? "");
    setOrganizer(event.organizer ?? "");
    setExpectedAttendance(
      event.expectedAttendance != null ? String(event.expectedAttendance) : "",
    );
    setImageUrl(event.imageUrl);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const attendance = expectedAttendance.trim()
        ? Number.parseInt(expectedAttendance, 10)
        : undefined;
      const url = editingId
        ? `/api/events/${editingId}`
        : `/api/maps/${mapId}/events`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          titleEl: titleEl.trim() || "",
          description: description.trim(),
          descriptionEl: descriptionEl.trim() || "",
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          bannerColor,
          bannerIcon,
          imageUrl,
          registrationUrl: registrationUrl.trim() || undefined,
          organizer: organizer.trim() || undefined,
          expectedAttendance:
            attendance != null && !Number.isNaN(attendance)
              ? attendance
              : undefined,
          anchors: anchor.refName.trim()
            ? [
                {
                  kind: "building",
                  refId: anchor.refId,
                  refName: anchor.refName.trim(),
                },
              ]
            : [],
          // See NewsAdminClient — Create only. Edit relies on the
          // Reach form for explicit resends.
          notify: editingId ? undefined : notify,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
      }
      const json = await res.json().catch(() => ({}));
      const list = await fetch(`/api/maps/${mapId}/events`).then((r) =>
        r.json(),
      );
      setEvents(list.events ?? []);
      reset();
      toast.success(editingId ? "Updated" : "Event published");
      const b = json?.broadcast;
      if (b?.requested) {
        if (b.ok) {
          toast.success(
            `Sent to ${b.attempted} subscriber(s) · ${b.delivered} delivered.`,
          );
        } else {
          toast.warn(`Push skipped: ${b.reason}`);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setEvents((e) => e.filter((event) => event.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          Upcoming & past
        </h2>
        <p className="mt-1 text-xs text-text-tertiary">
          {events.length} event{events.length === 1 ? "" : "s"}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {events.length === 0 ? (
            <p className="rounded-lg bg-surface-2 p-4 text-sm text-text-tertiary">
              No events yet. Use the form to publish your first one.
            </p>
          ) : (
            events.map((e) => (
              <article
                key={e.id}
                className="flex gap-3 rounded-lg border border-solid border-line-soft p-3"
              >
                {e.imageUrl ? (
                  <Image
                    src={e.imageUrl}
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
                        {e.title}
                      </h3>
                      <p className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-text-tertiary">
                        {formatEventWhen(e.startsAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        aria-label="Edit"
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-accent"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(e.id)}
                        aria-label="Delete"
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-600"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                    {e.description}
                  </p>
                  {e.anchors.length > 0 ? (
                    <p className="mt-1 text-[0.7rem] text-text-tertiary">
                      · {e.anchors.map((a) => a.refName).join(", ")}
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
            {editingId ? "Edit event" : "New event"}
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
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Open mic at the quad cafe"
              required
            />
          </Field>

          <Field label="Title (Greek, optional)">
            <Input
              value={titleEl}
              onChange={(e) => setTitleEl(e.target.value)}
              placeholder="Βραδιά ελεύθερου μικροφώνου"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What students need to know."
              rows={4}
              required
            />
          </Field>

          <Field label="Description (Greek, optional)">
            <Textarea
              value={descriptionEl}
              onChange={(e) => setDescriptionEl(e.target.value)}
              placeholder="Τι πρέπει να ξέρουν οι φοιτητές."
              rows={4}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </Field>
            <Field label="Ends">
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Banner colour">
              <Select
                value={bannerColor}
                onChange={(e) =>
                  setBannerColor(e.target.value as EventBanner)
                }
              >
                {BANNERS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Banner icon">
              <Select
                value={bannerIcon}
                onChange={(e) =>
                  setBannerIcon(e.target.value as EventIcon)
                }
              >
                {ICONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Where on campus (optional)">
            <AnchorPicker
              indoorMapId={indoorMapId}
              value={anchor}
              onChange={setAnchor}
              placeholder="Library, Cafe Pavilion, Mott Athletics…"
              ariaLabel="Anchor"
            />
          </Field>

          <Field label="Registration URL (optional)">
            <Input
              type="url"
              value={registrationUrl}
              onChange={(e) => setRegistrationUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Organizer (optional)">
              <Input
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="Music society"
              />
            </Field>
            <Field label="Expected attendance">
              <Input
                type="number"
                min="0"
                value={expectedAttendance}
                onChange={(e) => setExpectedAttendance(e.target.value)}
                placeholder="84"
              />
            </Field>
          </div>

          <Field
            label="Image (optional)"
            hint="Pick a stock cover or upload your own."
          >
            <ImagePicker
              value={imageUrl}
              onChange={setImageUrl}
              uploadPrefix={UPLOAD_PREFIXES.events}
              defaultCategory="events"
            />
          </Field>

          {/* Push notification toggle — Create only. See
              NewsAdminClient for the same reasoning. */}
          {!editingId && (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border border-solid p-3 transition-colors ${
                pushEnabled
                  ? "border-line-soft hover:border-accent/40"
                  : "cursor-not-allowed border-line-soft bg-surface-2/60 opacity-70"
              }`}
            >
              <input
                type="checkbox"
                checked={pushEnabled && notify}
                onChange={(e) => setNotify(e.target.checked)}
                disabled={!pushEnabled || submitting}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                aria-label="Send push notification when publishing"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-text-primary">
                  Send push notification
                </span>
                <span className="mt-0.5 block text-xs text-text-tertiary">
                  {pushEnabled
                    ? "Notify everyone who tapped “Get notifications” on this campus. Tapping the notification opens this event."
                    : "Disabled — set VAPID_* env vars to enable."}
                </span>
              </span>
            </label>
          )}

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
