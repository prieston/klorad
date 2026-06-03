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
  formatNewsDate,
  type NewsPost,
  type NewsCategory,
} from "@/lib/news";
import { AnchorPicker, type AnchorValue } from "@/lib/admin/AnchorPicker";

interface Props {
  mapId: string;
  initialPosts: NewsPost[];
  /** MappedIn venue id — when set, the anchor input becomes a picker. */
  indoorMapId?: string | null;
}

const EMPTY_ANCHOR: AnchorValue = { refName: "", refId: "" };

const CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "announcement", label: "Announcement" },
  { value: "news", label: "News" },
  { value: "alert", label: "Alert" },
];

/** Build a date suitable for an `<input type="date">` from today. */
function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Admin client for `/news`. Renders the existing posts on the left
 * (delete-only for Arc 2 — edit lands in a follow-up commit) and a
 * Create form on the right. The form posts to
 * `POST /api/maps/[mapId]/news` and revalidates the cached public
 * campus tag server-side so the new post shows up immediately.
 */
export function NewsAdminClient({
  mapId,
  initialPosts,
  indoorMapId,
}: Props) {
  const [posts, setPosts] = useState<NewsPost[]>(initialPosts);
  /** Non-null when the form is editing an existing post. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleEl, setTitleEl] = useState("");
  const [body, setBody] = useState("");
  const [bodyEl, setBodyEl] = useState("");
  const [category, setCategory] = useState<NewsCategory>("announcement");
  const [publishedAt, setPublishedAt] = useState(todayISODate());
  const [anchor, setAnchor] = useState<AnchorValue>(EMPTY_ANCHOR);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setTitleEl("");
    setBody("");
    setBodyEl("");
    setCategory("announcement");
    setPublishedAt(todayISODate());
    setAnchor(EMPTY_ANCHOR);
    setImageUrl(null);
  };

  /** Populate the form with a post's current values for editing. */
  const startEdit = (post: NewsPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setTitleEl(post.titleEl ?? "");
    setBody(post.body);
    setBodyEl(post.bodyEl ?? "");
    setCategory(post.category);
    setPublishedAt(post.publishedAt.slice(0, 10));
    setAnchor(
      post.anchors[0]
        ? { refName: post.anchors[0].refName, refId: post.anchors[0].refId }
        : EMPTY_ANCHOR,
    );
    setImageUrl(post.imageUrl);
    // Send focus to the top so the form is in view.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editingId
        ? `/api/news/${editingId}`
        : `/api/maps/${mapId}/news`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          titleEl: titleEl.trim() || "",
          body: body.trim(),
          bodyEl: bodyEl.trim() || "",
          category,
          // Datetime-local input gives a local-zone string; turn it
          // into a UTC ISO so the server stores a clean instant.
          publishedAt: new Date(publishedAt).toISOString(),
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
        throw new Error(err.error ?? "Failed to save");
      }
      // Optimistic refresh — re-fetch the list so the post updates.
      const list = await fetch(`/api/maps/${mapId}/news`).then((r) =>
        r.json(),
      );
      setPosts(list.posts ?? []);
      reset();
      toast.success(editingId ? "Updated" : "Published");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setPosts((p) => p.filter((post) => post.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          Published & scheduled
        </h2>
        <p className="mt-1 text-xs text-text-tertiary">
          {posts.length} post{posts.length === 1 ? "" : "s"}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {posts.length === 0 ? (
            <p className="rounded-lg bg-surface-2 p-4 text-sm text-text-tertiary">
              No news yet. Use the form to publish your first post.
            </p>
          ) : (
            posts.map((p) => (
              <article
                key={p.id}
                className="flex gap-3 rounded-lg border border-solid border-line-soft p-3"
              >
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
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
                        {p.title}
                      </h3>
                      <p className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-text-tertiary">
                        {p.category} · {formatNewsDate(p.publishedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        aria-label="Edit"
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-accent"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(p.id)}
                        aria-label="Delete"
                        className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-600"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                    {p.body}
                  </p>
                  {p.anchors.length > 0 ? (
                    <p className="mt-1 text-[0.7rem] text-text-tertiary">
                      · {p.anchors.map((a) => a.refName).join(", ")}
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
            {editingId ? "Edit post" : "New post"}
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
              placeholder="Library hours extended through finals"
              required
            />
          </Field>

          <Field label="Title (Greek, optional)">
            <Input
              value={titleEl}
              onChange={(e) => setTitleEl(e.target.value)}
              placeholder="Παρατεταμένες ώρες βιβλιοθήκης"
            />
          </Field>

          <Field label="Body">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What students need to know."
              rows={5}
              required
            />
          </Field>

          <Field label="Body (Greek, optional)">
            <Textarea
              value={bodyEl}
              onChange={(e) => setBodyEl(e.target.value)}
              placeholder="Τι πρέπει να ξέρουν οι φοιτητές."
              rows={5}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as NewsCategory)
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Publish on">
              <Input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
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

          <Field
            label="Image (optional)"
            hint="Pick a stock cover or upload your own."
          >
            <ImagePicker
              value={imageUrl}
              onChange={setImageUrl}
              uploadPrefix={UPLOAD_PREFIXES.news}
              defaultCategory="news"
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
