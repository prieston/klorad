"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "react-toastify";
import {
  Button,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "@klorad/design-system";
import {
  type CampusPost,
  type PostPlace,
  formatPostDate,
  readPosts,
} from "@/lib/posts";
import { readCampusPlaces } from "@/lib/places";

interface Props {
  mapId: string;
}

const GROUP_LABEL: Record<"building" | "floor" | "room", string> = {
  building: "Buildings",
  floor: "Floors",
  room: "Rooms",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServerMap {
  sceneData?: Record<string, unknown> & { posts?: CampusPost[] };
}

/**
 * Campus news authoring — the "News" tab of the campus profile.
 *
 * Posts are stored in `sceneData.posts` (see {@link readPosts}); each
 * save merges the full post list into the campus's `sceneData` via
 * the same PATCH branding uses. The public home page renders them.
 */
export default function NewsTab({ mapId }: Props) {
  const { data: serverMap } = useSWR<ServerMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );
  const posts = readPosts(serverMap?.sceneData);
  const places = useMemo(
    () => readCampusPlaces(serverMap?.sceneData),
    [serverMap],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPlaceId("");
  };

  const startEdit = (post: CampusPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setBody(post.body);
    setPlaceId(post.place?.id ?? "");
  };

  const persist = async (nextPosts: CampusPost[]) => {
    const nextSceneData = {
      ...(serverMap?.sceneData ?? {}),
      posts: nextPosts,
    };
    const res = await fetch(`/api/maps/${mapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneData: nextSceneData }),
    });
    if (!res.ok) throw new Error("Save failed");
    await mutate(`/api/maps/${mapId}`);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      const current = readPosts(serverMap?.sceneData);
      const linked = places.find((p) => p.id === placeId);
      const place: PostPlace | undefined = linked
        ? { id: linked.id, kind: linked.kind, name: linked.name }
        : undefined;
      const next: CampusPost[] = editingId
        ? current.map((p) =>
            p.id === editingId
              ? { ...p, title: trimmedTitle, body: body.trim(), place }
              : p,
          )
        : [
            {
              id: crypto.randomUUID(),
              title: trimmedTitle,
              body: body.trim(),
              publishedAt: new Date().toISOString(),
              place,
            },
            ...current,
          ];
      await persist(next);
      toast.success(editingId ? "Post updated" : "Post published");
      resetForm();
    } catch {
      toast.error("Could not save the post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await persist(readPosts(serverMap?.sceneData).filter((p) => p.id !== id));
      toast.success("Post deleted");
      if (editingId === id) resetForm();
    } catch {
      toast.error("Could not delete the post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pt-6">
      <Section title={editingId ? "Edit post" : "New post"}>
        <Panel className="space-y-4 rounded-2xl p-6">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Open day, exam schedule, campus closure…"
            />
          </Field>
          <Field label="Body">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's happening on campus…"
            />
          </Field>
          <Field
            label="Linked place (optional)"
            hint="Connect this post to a building, floor or room — it shows as a location on the public page."
          >
            <Select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
            >
              <option value="">— No place —</option>
              {(["building", "floor", "room"] as const).map((kind) => {
                const group = places.filter((p) => p.kind === kind);
                if (group.length === 0) return null;
                return (
                  <optgroup key={kind} label={GROUP_LABEL[kind]}>
                    {group.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Update post"
                  : "Publish post"}
            </Button>
            {editingId ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </Panel>
      </Section>

      <Section title="Published">
        {posts.length > 0 ? (
          <ul className="space-y-2">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-text-tertiary">
                    {formatPostDate(post.publishedAt)}
                  </div>
                  <div className="truncate text-sm font-medium text-text-primary">
                    {post.title}
                  </div>
                  {post.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                      {post.body}
                    </p>
                  ) : null}
                  {post.place ? (
                    <div className="mt-1 text-xs font-medium text-accent">
                      {post.place.name}
                    </div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(post)}
                  disabled={saving}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(post.id)}
                  disabled={saving}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <Panel className="rounded-2xl p-6">
            <p className="text-sm text-text-secondary">
              No posts yet. Publish your first campus update above — it
              appears on the public campus home page.
            </p>
          </Panel>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}
