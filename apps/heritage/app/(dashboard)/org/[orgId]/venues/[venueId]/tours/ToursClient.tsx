"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ArrowDown, ArrowUp, Plus, Route, Trash2, X } from "lucide-react";
import { Button, EmptyState, Field, Input, Panel, Select } from "@klorad/design-system";
import { PageHeader } from "@/lib/heritage/ui/page-header";
import {
  LocalizedField,
  compactLocalized,
  type LocalizedValue,
} from "@/lib/heritage/ui/localized-field";
import { StateBadge, PUBLISH_STATES, type PublishState } from "@/lib/heritage/ui/state";
import { pickLocalized } from "@/lib/heritage/i18n";
import { slugify } from "@/lib/heritage/slug";

const MODES = [
  ["both", "Screen and headset"],
  ["screen", "Screen only"],
  ["headset", "Headset only"],
] as const;

type Mode = (typeof MODES)[number][0];

interface Stop {
  sceneId: string | null;
  objectId: string | null;
  title: LocalizedValue;
  body: LocalizedValue;
}

interface Tour {
  id: string;
  slug: string;
  title: LocalizedValue;
  description: LocalizedValue;
  mode: Mode;
  state: PublishState;
  estimatedMinutes: number | null;
  isAccessibleRoute: boolean;
  stops: Stop[];
}

export function ToursClient({
  venueId,
  languages,
  defaultLanguage,
  scenes,
  objects,
  initial,
}: {
  venueId: string;
  languages: string[];
  defaultLanguage: string;
  scenes: { id: string; label: string }[];
  objects: { id: string; label: string }[];
  initial: Tour[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Tour | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const createTour = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Give the tour a title");
      return;
    }
    const slug = slugify(title);
    if (!slug) {
      toast.error("That title doesn't produce a usable URL");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/tours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title: { [defaultLanguage]: title } }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Create failed");
        return;
      }
      toast.success("Tour created");
      setNewTitle("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const saveTour = async () => {
    if (!editing) return;
    const title = compactLocalized(editing.title);
    if (!title[defaultLanguage]) {
      toast.error(`Give the tour a title in ${defaultLanguage}`);
      return;
    }
    for (const [i, s] of editing.stops.entries()) {
      if (!compactLocalized(s.title)[defaultLanguage]) {
        toast.error(`Stop ${i + 1} has no title in ${defaultLanguage}`);
        return;
      }
      if (!s.sceneId && !s.objectId) {
        toast.error(`Stop ${i + 1} points at neither a scene nor an object`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/tours/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: compactLocalized(editing.description),
          mode: editing.mode,
          state: editing.state,
          estimatedMinutes: editing.estimatedMinutes,
          isAccessibleRoute: editing.isAccessibleRoute,
          stops: editing.stops.map((s) => ({
            sceneId: s.sceneId,
            objectId: s.objectId,
            title: compactLocalized(s.title),
            body: compactLocalized(s.body),
            mediaRepresentationIds: [],
          })),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Save failed");
        return;
      }
      toast.success("Tour saved");
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const removeTour = async (id: string) => {
    const res = await fetch(`/api/venues/${venueId}/tours/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Tour deleted");
    router.refresh();
  };

  const patchStop = (i: number, patch: Partial<Stop>) => {
    if (!editing) return;
    const stops = [...editing.stops];
    stops[i] = { ...stops[i], ...patch };
    setEditing({ ...editing, stops });
  };

  const moveStop = (i: number, delta: number) => {
    if (!editing) return;
    const j = i + delta;
    if (j < 0 || j >= editing.stops.length) return;
    const stops = [...editing.stops];
    [stops[i], stops[j]] = [stops[j], stops[i]];
    setEditing({ ...editing, stops });
  };

  if (editing) {
    return (
      <main className="mx-auto w-full max-w-[900px] px-6 py-10 md:px-10">
        <PageHeader
          title="Edit tour."
          lede="Stops run in the order below. The same sequence drives the on-screen tour and the guided walk in a headset."
          actions={
            <>
              <Button onClick={saveTour} disabled={saving}>
                {saving ? "Saving…" : "Save tour"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </>
          }
        />

        <Panel className="mb-6 rounded-2xl p-6">
          <div className="grid gap-5">
            <LocalizedField
              label="Title"
              value={editing.title}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(title) => setEditing({ ...editing, title })}
            />
            <LocalizedField
              label="Description"
              multiline
              value={editing.description}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(description) => setEditing({ ...editing, description })}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Delivery">
                <Select
                  value={editing.mode}
                  onChange={(e) =>
                    setEditing({ ...editing, mode: e.target.value as Mode })
                  }
                >
                  {MODES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estimated minutes">
                <Input
                  type="number"
                  value={editing.estimatedMinutes ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      estimatedMinutes:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Publication state">
                <Select
                  value={editing.state}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      state: e.target.value as PublishState,
                    })
                  }
                >
                  {PUBLISH_STATES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={editing.isAccessibleRoute}
                onChange={(e) =>
                  setEditing({ ...editing, isAccessibleRoute: e.target.checked })
                }
                className="mt-1"
              />
              <span className="text-text-secondary">
                Accessible route.{" "}
                <span className="text-text-tertiary">
                  A wheelchair user at an archaeological site needs to know about
                  gravel before committing to a path, so this is a first-class
                  option rather than a variant.
                </span>
              </span>
            </label>
          </div>
        </Panel>

        <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          Stops
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] tracking-normal text-accent">
            {editing.stops.length}
          </span>
        </h2>

        <ol className="mb-4 space-y-3">
          {editing.stops.map((s, i) => (
            <li key={i} className="rounded-2xl border border-line-soft bg-bg p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium text-accent">
                  {i + 1}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStop(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-text-primary disabled:opacity-30"
                  >
                    <ArrowUp size={13} strokeWidth={1.8} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(i, 1)}
                    disabled={i === editing.stops.length - 1}
                    aria-label="Move down"
                    className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-text-primary disabled:opacity-30"
                  >
                    <ArrowDown size={13} strokeWidth={1.8} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        stops: editing.stops.filter((_, j) => j !== i),
                      })
                    }
                    aria-label="Remove stop"
                    className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-red-600"
                  >
                    <X size={13} strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="grid gap-4">
                <LocalizedField
                  label="Stop title"
                  value={s.title}
                  languages={languages}
                  defaultLanguage={defaultLanguage}
                  onChange={(title) => patchStop(i, { title })}
                />
                <LocalizedField
                  label="Narration"
                  multiline
                  value={s.body}
                  languages={languages}
                  defaultLanguage={defaultLanguage}
                  onChange={(body) => patchStop(i, { body })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Scene">
                    <Select
                      value={s.sceneId ?? ""}
                      onChange={(e) =>
                        patchStop(i, { sceneId: e.target.value || null })
                      }
                    >
                      <option value="">— none —</option>
                      {scenes.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Object">
                    <Select
                      value={s.objectId ?? ""}
                      onChange={(e) =>
                        patchStop(i, { objectId: e.target.value || null })
                      }
                    >
                      <option value="">— none —</option>
                      {objects.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Button
          variant="secondary"
          onClick={() =>
            setEditing({
              ...editing,
              stops: [
                ...editing.stops,
                { sceneId: null, objectId: null, title: {}, body: {} },
              ],
            })
          }
        >
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          Add stop
        </Button>

        <p className="mt-6 text-xs leading-relaxed text-text-tertiary">
          Camera poses and per-stop audio are set from the scene viewer, which
          is a later arc. A stop saved here already carries its text in every
          language and its target — the pose is the part that needs a renderer
          to author.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="Tours."
        lede="An ordered walk through the venue. Authored once, delivered on a screen as a virtual tour and in a headset as a guided walk."
      />

      <Panel className="mb-8 rounded-2xl p-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="New tour" className="min-w-[260px] flex-1">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createTour();
                }
              }}
              placeholder="e.g. Highlights in one hour"
            />
          </Field>
          <Button onClick={createTour} disabled={saving}>
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            Create
          </Button>
        </div>
      </Panel>

      {initial.length === 0 ? (
        <EmptyState
          tone="dashed"
          icon={Route}
          title="No tours yet."
          body="A tour is the direct answer to what museum procurement calls a virtual tour — an ordered sequence of stops with text and media per language."
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {initial.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => setEditing(t)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-medium text-text-primary hover:text-accent">
                  {pickLocalized(t.title, defaultLanguage) ?? t.slug}
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {t.stops.length} stops ·{" "}
                  {MODES.find(([v]) => v === t.mode)?.[1]}
                  {t.estimatedMinutes ? ` · ${t.estimatedMinutes} min` : ""}
                  {t.isAccessibleRoute ? " · accessible route" : ""}
                </p>
              </button>
              <StateBadge state={t.state} />
              <button
                type="button"
                onClick={() => void removeTour(t.id)}
                aria-label="Delete tour"
                className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-red-600"
              >
                <Trash2 size={14} strokeWidth={1.8} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
