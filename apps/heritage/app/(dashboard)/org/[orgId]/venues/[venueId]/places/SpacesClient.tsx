"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Input, Panel, Select } from "@klorad/design-system";
import { PageHeader } from "@/lib/heritage/ui/page-header";
import {
  LocalizedField,
  compactLocalized,
  type LocalizedValue,
} from "@/lib/heritage/ui/localized-field";
import { pickLocalized } from "@/lib/heritage/i18n";
import { slugify } from "@/lib/heritage/slug";
import { StateBadge, PUBLISH_STATES, type PublishState } from "@/lib/heritage/ui/state";

const KINDS = [
  ["gallery", "Gallery"],
  ["room", "Room"],
  ["sector", "Sector"],
  ["scanned_scene", "Scanned scene"],
  ["exterior", "Exterior"],
  ["storage", "Storage"],
] as const;

type Kind = (typeof KINDS)[number][0];

interface Row {
  id: string;
  slug: string;
  kind: Kind;
  name: LocalizedValue;
  description: LocalizedValue;
  floor: number | null;
  sortOrder: number;
  state: PublishState;
  sceneCount: number;
  objectCount: number;
}

const blank = (): Omit<Row, "id" | "sceneCount" | "objectCount"> => ({
  slug: "",
  kind: "gallery",
  name: {},
  description: {},
  floor: null,
  sortOrder: 0,
  state: "draft",
});

export function SpacesClient({
  venueId,
  languages,
  defaultLanguage,
  initial,
}: {
  venueId: string;
  languages: string[];
  defaultLanguage: string;
  initial: Row[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState(blank());
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = editing ?? draft;
  const setForm = (patch: Partial<Row>) =>
    editing
      ? setEditing({ ...editing, ...patch })
      : setDraft({ ...draft, ...patch });

  const close = () => {
    setEditing(null);
    setCreating(false);
    setDraft(blank());
  };

  const save = async () => {
    const name = compactLocalized(form.name);
    if (!name[defaultLanguage]) {
      toast.error(`Give the space a name in ${defaultLanguage}`);
      return;
    }
    const slug = form.slug || slugify(name[defaultLanguage]);
    if (!slug) {
      toast.error("That name doesn't produce a usable URL — set one manually");
      return;
    }
    setSaving(true);
    try {
      const body = {
        slug,
        name,
        description: compactLocalized(form.description),
        kind: form.kind,
        floor: form.floor,
        sortOrder: form.sortOrder,
        ...(editing ? { state: form.state } : {}),
      };
      const res = await fetch(
        editing
          ? `/api/venues/${venueId}/spaces/${editing.id}`
          : `/api/venues/${venueId}/spaces`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Save failed");
        return;
      }
      toast.success(editing ? "Space updated" : "Space created");
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (row.sceneCount > 0 || row.objectCount > 0) {
      toast.error(
        `"${pickLocalized(row.name, defaultLanguage) ?? row.slug}" still holds ${row.objectCount} objects and ${row.sceneCount} scenes. Move them first.`,
      );
      return;
    }
    const res = await fetch(`/api/venues/${venueId}/spaces/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      toast.error(json.error ?? "Delete failed");
      return;
    }
    toast.success("Space deleted");
    router.refresh();
  };

  const open = creating || editing !== null;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="Places."
        lede="A gallery, a sector, a room, or one scanned scene. Objects live in a space, and scenes are captured of one."
        actions={
          <Button onClick={() => (open ? close() : setCreating(true))}>
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            {open ? "Cancel" : "New space"}
          </Button>
        }
      />

      {open && (
        <Panel className="mb-8 rounded-2xl p-6">
          <h2 className="mb-5 text-lg font-medium text-text-primary">
            {editing ? "Edit space" : "Create space"}
          </h2>
          <div className="grid gap-5">
            <LocalizedField
              label="Name"
              value={form.name}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(name) => setForm({ name })}
              placeholder="e.g. Prehistoric Gallery"
            />
            <LocalizedField
              label="Description"
              multiline
              value={form.description}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(description) => setForm({ description })}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Kind">
                <Select
                  value={form.kind}
                  onChange={(e) => setForm({ kind: e.target.value as Kind })}
                >
                  {KINDS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Floor"
                hint="For the plan view. Leave blank for outdoor sectors."
              >
                <Input
                  type="number"
                  value={form.floor ?? ""}
                  onChange={(e) =>
                    setForm({
                      floor: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Order">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ sortOrder: Number(e.target.value) })}
                />
              </Field>
            </div>
            {editing && (
              <Field label="Publication state">
                <Select
                  value={form.state}
                  onChange={(e) =>
                    setForm({ state: e.target.value as PublishState })
                  }
                >
                  {PUBLISH_STATES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {initial.length === 0 ? (
        <EmptyState
          tone="dashed"
          icon={Building2}
          title="No places yet."
          body="Add the galleries, sectors or scanned areas this venue is divided into."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={14} strokeWidth={1.8} aria-hidden />
              Create the first space
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {initial.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(s);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-medium text-text-primary hover:text-accent">
                  {pickLocalized(s.name, defaultLanguage) ?? s.slug}
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {KINDS.find(([v]) => v === s.kind)?.[1]}
                  {s.floor !== null ? ` · floor ${s.floor}` : ""} · {s.objectCount}{" "}
                  objects · {s.sceneCount} scenes
                </p>
              </button>
              <StateBadge state={s.state} />
              <button
                type="button"
                onClick={() => void remove(s)}
                aria-label="Delete space"
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
