"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Link from "next/link";
import { AlertTriangle, Layers, Move3d, Plus, Trash2, X } from "lucide-react";
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

const SCENE_KINDS = [
  ["mesh", "Mesh environment"],
  ["splat", "Gaussian splat capture"],
  ["composite", "Composite (splat + meshes)"],
  ["panorama", "360 panorama"],
] as const;

const ROLES = [
  ["base", "Base"],
  ["object", "Object"],
  ["overlay", "Overlay"],
  ["environment", "Environment"],
  ["proxy_source", "Proxy source"],
] as const;

type SceneKind = (typeof SCENE_KINDS)[number][0];
type Role = (typeof ROLES)[number][0];

interface Layer {
  id: string;
  role: Role;
  isVisible: boolean;
  representationId: string;
  representationKind: string;
  representationLabel: string;
  splatCount: number | null;
  triangleCount: number | null;
}

interface Row {
  id: string;
  slug: string;
  kind: SceneKind;
  title: LocalizedValue;
  description: LocalizedValue;
  spaceId: string | null;
  status: string;
  state: PublishState;
  tilesetUrl: string | null;
  floorProxyUrl: string | null;
  splatBudget: number | null;
  lastRecapturedAt: string | null;
  proxyCount: number;
  tourStopCount: number;
  layers: Layer[];
}

type Draft = Pick<Row, "slug" | "kind" | "title" | "description" | "spaceId">;

const blank = (): Draft => ({
  slug: "",
  kind: "mesh",
  title: {},
  description: {},
  spaceId: null,
});

export function ScenesClient({
  venueId,
  orgId,
  languages,
  defaultLanguage,
  spaces,
  representations,
  initial,
}: {
  orgId: string;
  venueId: string;
  languages: string[];
  defaultLanguage: string;
  spaces: { id: string; label: string }[];
  representations: { id: string; kind: string; status: string; label: string }[];
  initial: Row[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank());
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<Record<string, { repId: string; role: Role }>>({});

  const create = async () => {
    const title = compactLocalized(draft.title);
    if (!title[defaultLanguage]) {
      toast.error(`Give the scene a title in ${defaultLanguage}`);
      return;
    }
    const slug = draft.slug || slugify(title[defaultLanguage]);
    if (!slug) {
      toast.error("That title doesn't produce a usable URL — set one manually");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          description: compactLocalized(draft.description),
          kind: draft.kind,
          spaceId: draft.spaceId,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Create failed");
        return;
      }
      toast.success("Scene created");
      setCreating(false);
      setDraft(blank());
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const patchScene = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/venues/${venueId}/scenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Save failed");
      return;
    }
    router.refresh();
  };

  const removeScene = async (row: Row) => {
    if (row.proxyCount > 0 || row.tourStopCount > 0) {
      toast.error(
        `This scene holds ${row.proxyCount} proxies and ${row.tourStopCount} tour stops. Deleting it discards the proxy authoring — remove them first.`,
      );
      return;
    }
    const res = await fetch(`/api/venues/${venueId}/scenes/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Scene deleted");
    router.refresh();
  };

  const addLayer = async (sceneId: string) => {
    const sel = addKind[sceneId];
    if (!sel?.repId) {
      toast.error("Pick a capture to add");
      return;
    }
    const res = await fetch(`/api/venues/${venueId}/scenes/${sceneId}/layers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ representationId: sel.repId, role: sel.role }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Could not add layer");
      return;
    }
    setAddKind({ ...addKind, [sceneId]: { repId: "", role: "object" } });
    router.refresh();
  };

  const removeLayer = async (sceneId: string, layerId: string) => {
    const res = await fetch(
      `/api/venues/${venueId}/scenes/${sceneId}/layers/${layerId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Could not remove layer");
      return;
    }
    router.refresh();
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="Scenes."
        lede="A renderable unit — one capture, or a composition of several. A splat site with mesh artifacts on plinths is the case this is built for."
        actions={
          <Button onClick={() => setCreating((c) => !c)}>
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            {creating ? "Cancel" : "New scene"}
          </Button>
        }
      />

      {creating && (
        <Panel className="mb-8 rounded-2xl p-6">
          <h2 className="mb-5 text-lg font-medium text-text-primary">
            Create scene
          </h2>
          <div className="grid gap-5">
            <LocalizedField
              label="Title"
              value={draft.title}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(title) => setDraft({ ...draft, title })}
              placeholder="e.g. West terrace"
            />
            <LocalizedField
              label="Description"
              multiline
              value={draft.description}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(description) => setDraft({ ...draft, description })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Dominant representation"
                hint="Never a full splat budget and a full mesh budget in one scene."
              >
                <Select
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({ ...draft, kind: e.target.value as SceneKind })
                  }
                >
                  {SCENE_KINDS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Space">
                <Select
                  value={draft.spaceId ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, spaceId: e.target.value || null })
                  }
                >
                  <option value="">— not placed —</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {initial.length === 0 ? (
        <EmptyState
          tone="dashed"
          icon={Layers}
          title="No scenes yet."
          body="A scene is what a visitor actually explores. Create one, then compose it from the captures you have ingested."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={14} strokeWidth={1.8} aria-hidden />
              Create the first scene
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {initial.map((s) => {
            const isOpen = expanded === s.id;
            const sel = addKind[s.id] ?? { repId: "", role: "object" as Role };
            return (
              <li key={s.id} className="rounded-2xl border border-line-soft bg-bg">
                <div className="flex flex-wrap items-center gap-4 p-5">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-text-primary hover:text-accent">
                      {pickLocalized(s.title, defaultLanguage) ?? s.slug}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {SCENE_KINDS.find(([v]) => v === s.kind)?.[1]} ·{" "}
                      {s.layers.length} item{s.layers.length === 1 ? "" : "s"} ·{" "}
                      {s.proxyCount} point{s.proxyCount === 1 ? "" : "s"} of interest
                    </p>
                  </button>
                  <StateBadge state={s.state} />
                  {/* The primary action on a scene is opening it, not editing
                      its metadata. This row expands to a settings form, which
                      is the secondary job. */}
                  <Link
                    href={`/org/${orgId}/venues/${venueId}/scenes/${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
                  >
                    <Move3d size={12} strokeWidth={2} aria-hidden />
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeScene(s)}
                    aria-label="Delete scene"
                    className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-red-600"
                  >
                    <Trash2 size={14} strokeWidth={1.8} aria-hidden />
                  </button>
                </div>

                {s.lastRecapturedAt && s.proxyCount > 0 && (
                  <p className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-text-secondary">
                    <AlertTriangle
                      size={13}
                      strokeWidth={1.8}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-amber-600"
                    />
                    Recaptured{" "}
                    {new Date(s.lastRecapturedAt).toLocaleDateString()}. Proxies
                    placed against the previous geometry need re-checking.
                  </p>
                )}

                {isOpen && (
                  <div className="border-t border-line-soft p-5">
                    <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
                      Composition
                    </h3>
                    {s.layers.length === 0 ? (
                      <p className="mb-4 text-sm text-text-tertiary">
                        Nothing composed yet. Add the capture this scene renders.
                      </p>
                    ) : (
                      <ul className="mb-4 divide-y divide-line-soft">
                        {s.layers.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center gap-3 py-2.5"
                          >
                            <span className="w-24 shrink-0 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                              {ROLES.find(([v]) => v === l.role)?.[1]}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                              {l.representationLabel}
                            </span>
                            <span className="shrink-0 text-xs text-text-tertiary">
                              {l.splatCount
                                ? `${l.splatCount.toLocaleString()} splats`
                                : l.triangleCount
                                  ? `${l.triangleCount.toLocaleString()} tris`
                                  : "not measured"}
                            </span>
                            <button
                              type="button"
                              onClick={() => void removeLayer(s.id, l.id)}
                              aria-label="Remove layer"
                              className="shrink-0 rounded-full p-1 text-text-tertiary hover:bg-surface-2 hover:text-red-600"
                            >
                              <X size={12} strokeWidth={2} aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="Add capture" className="min-w-[240px] flex-1">
                        <Select
                          value={sel.repId}
                          onChange={(e) =>
                            setAddKind({
                              ...addKind,
                              [s.id]: { ...sel, repId: e.target.value },
                            })
                          }
                        >
                          <option value="">— choose —</option>
                          {representations.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label} ({r.kind}
                              {r.status !== "ready" ? `, ${r.status}` : ""})
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Role">
                        <Select
                          value={sel.role}
                          onChange={(e) =>
                            setAddKind({
                              ...addKind,
                              [s.id]: { ...sel, role: e.target.value as Role },
                            })
                          }
                        >
                          {ROLES.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button variant="secondary" onClick={() => void addLayer(s.id)}>
                        Add
                      </Button>
                    </div>

                    <div className="mt-6 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-3">
                      <Field label="Publication state">
                        <Select
                          value={s.state}
                          onChange={(e) =>
                            void patchScene(s.id, { state: e.target.value })
                          }
                        >
                          {PUBLISH_STATES.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Splat budget"
                        hint="Authoring aid, not enforced."
                      >
                        <Input
                          type="number"
                          defaultValue={s.splatBudget ?? ""}
                          onBlur={(e) =>
                            void patchScene(s.id, {
                              splatBudget:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Floor proxy URL"
                        hint="Splats have no surface, so no collision."
                      >
                        <Input
                          defaultValue={s.floorProxyUrl ?? ""}
                          onBlur={(e) =>
                            void patchScene(s.id, {
                              floorProxyUrl: e.target.value || null,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
