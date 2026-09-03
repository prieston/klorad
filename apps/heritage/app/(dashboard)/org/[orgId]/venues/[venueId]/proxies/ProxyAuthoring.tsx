"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Check,
  Copy,
  Move3d,
  RotateCw,
  Scaling,
  Target,
  Trash2,
} from "lucide-react";
import { Button, Field, Select } from "@klorad/design-system";
import type { HeritageViewer } from "@klorad/engine-three/viewer";
import { PageHeader } from "@/lib/heritage/ui/page-header";
import {
  LocalizedField,
  compactLocalized,
  type LocalizedValue,
} from "@/lib/heritage/ui/localized-field";
import { pickLocalized } from "@/lib/heritage/i18n";

type Shape = "box" | "sphere" | "cylinder" | "plane" | "mesh";
type Interaction = "none" | "info" | "tour_stop" | "external_link" | "scene_link";
type Transform = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

const SHAPES: [Shape, string][] = [
  ["box", "Box"],
  ["sphere", "Sphere"],
  ["cylinder", "Cylinder"],
  ["plane", "Plane"],
];

const INTERACTIONS: [Interaction, string][] = [
  ["info", "Show the record"],
  ["tour_stop", "Tour stop"],
  ["external_link", "External link"],
  ["scene_link", "Go to another scene"],
  ["none", "No interaction (floor or collision)"],
];

interface Proxy {
  id: string;
  shape: Shape;
  interaction: Interaction;
  transform: unknown;
  label: LocalizedValue;
  objectId: string | null;
  objectLabel: string | null;
  state: string;
  invalidatedAt: string | null;
}

export function ProxyAuthoring({
  venueId,
  languages,
  defaultLanguage,
  scenes,
  activeSceneId,
  layers,
  hasSplatLayers,
  objects,
  initialProxies,
}: {
  venueId: string;
  languages: string[];
  defaultLanguage: string;
  scenes: {
    id: string;
    label: string;
    proxyCount: number;
    lastRecapturedAt: string | null;
  }[];
  activeSceneId: string | null;
  layers: { id: string; url: string; transform?: unknown }[];
  hasSplatLayers: boolean;
  objects: { id: string; label: string }[];
  initialProxies: Proxy[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HeritageViewer | null>(null);

  const [proxies, setProxies] = useState<Proxy[]>(initialProxies);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const selected = proxies.find((p) => p.id === selectedId) ?? null;
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;

  const markDirty = useCallback((id: string) => {
    setDirty((d) => new Set(d).add(id));
  }, []);

  /** Create on the server first, so the row has a real id before it is drawn.
   *  A client-side temporary id would have to be reconciled on save, and a
   *  reconciliation bug here loses authoring work a curator cannot redo. */
  const placeProxy = useCallback(
    async (transform: Transform) => {
      if (!activeSceneId) return;
      const res = await fetch(`/api/venues/${venueId}/proxies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: activeSceneId,
          shape: "box",
          interaction: "info",
          transform,
          sortOrder: proxies.length,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        toast.error(json.error ?? "Could not place proxy");
        return;
      }
      const created: Proxy = {
        id: json.id,
        shape: "box",
        interaction: "info",
        transform,
        label: {},
        objectId: null,
        objectLabel: null,
        state: "draft",
        invalidatedAt: null,
      };
      setProxies((ps) => [...ps, created]);
      setSelectedId(json.id);
      viewerRef.current?.addProxy({
        id: json.id,
        shape: "box",
        transform,
        label: null,
      });
      viewerRef.current?.selectProxyById(json.id);
    },
    [activeSceneId, venueId, proxies.length],
  );

  const onTransform = useCallback(
    (id: string, transform: Transform) => {
      setProxies((ps) =>
        ps.map((p) => (p.id === id ? { ...p, transform } : p)),
      );
      markDirty(id);
    },
    [markDirty],
  );

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || layers.length === 0) return;

    void (async () => {
      const mod = await import("@klorad/engine-three/viewer");
      if (cancelled || !hostRef.current) return;
      viewerRef.current = new mod.HeritageViewer({
        container: hostRef.current,
        layers,
        proxies: initialProxies.map((p) => ({
          id: p.id,
          shape: p.shape,
          transform: p.transform,
          label: pickLocalized(p.label, defaultLanguage),
        })),
        editable: true,
        // 1 cm. Fine enough for an object on a plinth, coarse enough that two
        // proxies placed by eye do not end up a millimetre apart.
        snap: 0.01,
        onSelectProxy: (id) => setSelectedId(id),
        onPlaceProxy: (t) => void placeProxy(t as Transform),
        onTransformProxy: (id, t) => onTransform(id, t as Transform),
      });
    })();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // Rebuilding on every render would tear down the WebGL context mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "w") viewerRef.current?.setGizmoMode("translate");
      if (e.key === "e") viewerRef.current?.setGizmoMode("rotate");
      if (e.key === "r") viewerRef.current?.setGizmoMode("scale");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patchLocal = (patch: Partial<Proxy>) => {
    if (!selectedId) return;
    setProxies((ps) =>
      ps.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)),
    );
    markDirty(selectedId);
  };

  const saveAll = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all(
        [...dirty].map(async (id) => {
          const p = proxies.find((x) => x.id === id);
          if (!p) return true;
          const res = await fetch(`/api/venues/${venueId}/proxies/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shape: p.shape,
              interaction: p.interaction,
              transform: p.transform,
              label: compactLocalized(p.label),
              objectId: p.objectId,
              state: p.state,
            }),
          });
          return res.ok;
        }),
      );
      const failed = results.filter((ok) => !ok).length;
      if (failed > 0) {
        toast.error(`${failed} proxy change${failed === 1 ? "" : "s"} failed to save`);
        return;
      }
      toast.success(`Saved ${dirty.size} change${dirty.size === 1 ? "" : "s"}`);
      setDirty(new Set());
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!selected || !activeSceneId) return;
    const t = selected.transform as Transform;
    // Offset so the copy is visible rather than hidden inside the original.
    const transform: Transform = {
      ...t,
      position: [t.position[0] + 0.25, t.position[1], t.position[2]],
    };
    await placeProxy(transform);
  };

  const remove = async () => {
    if (!selected) return;
    const res = await fetch(`/api/venues/${venueId}/proxies/${selected.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    viewerRef.current?.removeProxy(selected.id);
    setProxies((ps) => ps.filter((p) => p.id !== selected.id));
    setSelectedId(null);
    router.refresh();
  };

  const revalidate = async () => {
    if (!selected) return;
    const res = await fetch(`/api/venues/${venueId}/proxies/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revalidate: true }),
    });
    if (!res.ok) {
      toast.error("Could not confirm");
      return;
    }
    setProxies((ps) =>
      ps.map((p) => (p.id === selected.id ? { ...p, invalidatedAt: null } : p)),
    );
    toast.success("Confirmed against the new capture");
    router.refresh();
  };

  const switchScene = (id: string) => {
    if (dirty.size > 0) {
      toast.error("Save your changes before switching scene");
      return;
    }
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("scene", id);
    router.push(`?${params.toString()}`);
  };

  const staleCount = proxies.filter((p) => p.invalidatedAt).length;

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col px-6 py-6 md:px-10 lg:h-full">
      <PageHeader
        title="Proxies."
        lede="A captured surface has no objects in it — a tap has to land on something a curator placed. These are that something."
        actions={
          <>
            {scenes.length > 1 ? (
              <Select
                value={activeSceneId ?? ""}
                onChange={(e) => switchScene(e.target.value)}
                className="max-w-[260px]"
              >
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.proxyCount})
                  </option>
                ))}
              </Select>
            ) : null}
            <Button onClick={saveAll} disabled={saving || dirty.size === 0}>
              {saving
                ? "Saving…"
                : dirty.size > 0
                  ? `Save ${dirty.size} change${dirty.size === 1 ? "" : "s"}`
                  : "Saved"}
            </Button>
          </>
        }
      />

      {scenes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-soft p-10 text-center text-sm text-text-tertiary">
          No scenes yet. Create one and compose it from a capture first — a
          proxy is placed inside a scene.
        </p>
      ) : (
        <>
          {staleCount > 0 && activeScene?.lastRecapturedAt && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
              <AlertTriangle
                size={18}
                strokeWidth={1.7}
                aria-hidden
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <div className="text-sm">
                <p className="font-medium text-text-primary">
                  {staleCount} {staleCount === 1 ? "proxy was" : "proxies were"}{" "}
                  placed against the previous capture
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  This scene was recaptured{" "}
                  {new Date(activeScene.lastRecapturedAt).toLocaleDateString()}.
                  Geometry moves between captures, and a proxy pointing at where
                  something used to be is worse than a missing one. Check each
                  and confirm it.
                </p>
              </div>
            </div>
          )}

          {/* `min-h-0` lets these columns shrink inside the flex page. Without
              it a flex child keeps its content height and the canvas grows the
              page instead of fitting it. */}
          <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_320px]">
            <div className="flex min-h-0 flex-col">
              {layers.length > 0 ? (
                <>
                  <div
                    ref={hostRef}
                    // Fills whatever the layout leaves, with a floor so the
                    // canvas stays usable on a short laptop screen rather than
                    // collapsing to a strip.
                    className="h-[55vh] min-h-[320px] w-full overflow-hidden rounded-2xl bg-surface-2 lg:h-auto lg:flex-1"
                  />
                  <p className="mt-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-tertiary">
                    <span>Click the model to place a proxy · click a proxy to select</span>
                    <span className="inline-flex items-center gap-1">
                      <Move3d size={11} strokeWidth={1.8} aria-hidden /> W move
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <RotateCw size={11} strokeWidth={1.8} aria-hidden /> E rotate
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Scaling size={11} strokeWidth={1.8} aria-hidden /> R scale
                    </span>
                    <span>Snapping to 1 cm</span>
                  </p>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-line-soft p-10 text-center">
                  <p className="text-sm text-text-secondary">
                    {hasSplatLayers
                      ? "This scene is a photorealistic capture."
                      : "This scene has no geometry yet."}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-text-tertiary">
                    {hasSplatLayers
                      ? "Placing proxies against a splat capture needs the splat renderer, which is not published — no measured benchmark of it in a headset browser exists yet, and building on an unverified number is how this ships beautiful and untappable. Proxies for this scene can still be listed and bound below."
                      : "Compose the scene from an ingested capture, then place proxies in it."}
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
                  <Target size={12} strokeWidth={1.8} aria-hidden />
                  Placed
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] tracking-normal text-accent">
                    {proxies.length}
                  </span>
                </h2>
                {proxies.length === 0 ? (
                  <p className="text-xs text-text-tertiary">
                    Nothing placed yet.
                  </p>
                ) : (
                  <ul className="max-h-[200px] divide-y divide-line-soft overflow-y-auto">
                    {proxies.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(p.id);
                            viewerRef.current?.selectProxyById(p.id);
                          }}
                          className={`flex w-full items-center gap-2 py-2 text-left text-xs ${
                            p.id === selectedId
                              ? "text-accent"
                              : "text-text-primary hover:text-accent"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {pickLocalized(p.label, defaultLanguage) ??
                              p.objectLabel ??
                              "Unlabelled"}
                          </span>
                          {p.invalidatedAt ? (
                            <AlertTriangle
                              size={11}
                              strokeWidth={2}
                              aria-hidden
                              className="shrink-0 text-amber-600"
                            />
                          ) : null}
                          {dirty.has(p.id) ? (
                            <span
                              aria-label="unsaved"
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                            />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected ? (
                <div className="space-y-4 rounded-2xl border border-line-soft bg-bg p-4">
                  {selected.invalidatedAt ? (
                    <button
                      type="button"
                      onClick={revalidate}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-500/20"
                    >
                      <Check size={12} strokeWidth={2} aria-hidden />
                      Confirm against the new capture
                    </button>
                  ) : null}

                  <Field label="Bound object" hint="What a visitor sees when they tap it.">
                    <Select
                      value={selected.objectId ?? ""}
                      onChange={(e) =>
                        patchLocal({ objectId: e.target.value || null })
                      }
                    >
                      <option value="">— not bound —</option>
                      {objects.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <LocalizedField
                    label="Label"
                    hint="Falls back to the bound object's title."
                    value={selected.label}
                    languages={languages}
                    defaultLanguage={defaultLanguage}
                    onChange={(label) => patchLocal({ label })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Shape">
                      <Select
                        value={selected.shape}
                        onChange={(e) =>
                          patchLocal({ shape: e.target.value as Shape })
                        }
                      >
                        {SHAPES.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="On tap">
                      <Select
                        value={selected.interaction}
                        onChange={(e) =>
                          patchLocal({
                            interaction: e.target.value as Interaction,
                          })
                        }
                      >
                        {INTERACTIONS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field label="Publication state">
                    <Select
                      value={selected.state}
                      onChange={(e) => patchLocal({ state: e.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="in_review">In review</option>
                      <option value="approved">Approved</option>
                      <option value="published">Published</option>
                    </Select>
                  </Field>

                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={duplicate} className="flex-1">
                      <Copy size={13} strokeWidth={1.8} aria-hidden />
                      Duplicate
                    </Button>
                    <button
                      type="button"
                      onClick={remove}
                      aria-label="Delete proxy"
                      className="rounded-md border border-line-strong px-3 text-text-tertiary hover:border-red-500 hover:text-red-600"
                    >
                      <Trash2 size={14} strokeWidth={1.8} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-line-soft p-5 text-xs leading-relaxed text-text-tertiary">
                  Select a proxy to bind it to an object and set what tapping it
                  does. An unbound proxy is geometry a visitor can hit that
                  shows them nothing.
                </p>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
