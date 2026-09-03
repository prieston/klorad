"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Crosshair,
  ExternalLink,
  Loader2,
  Move3d,
  Plus,
  Save,
  Target,
  Trash2,
} from "lucide-react";
import { ViewerCanvas } from "@/lib/heritage/ui/ViewerCanvas";
import { PageHeader } from "@/lib/heritage/ui/page-header";

interface Layer {
  id: string;
  representationId: string;
  label: string;
  role: string;
  url: string | null;
  transform: unknown;
  kind: string;
}

interface Proxy {
  id: string;
  label: string;
  shape: "box" | "sphere" | "cylinder" | "plane" | "mesh";
  transform: unknown;
  objectId: string | null;
  invalidatedAt: string | null;
}

type Transform = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

/**
 * Compose a scene by looking at it.
 *
 * Two jobs share this canvas and they are deliberately separate modes rather
 * than one list of clickable things: arranging models, and marking points on
 * them. A click that sometimes moves a statue and sometimes drops a pin on it
 * would be unpredictable in exactly the way authoring tools must not be.
 *
 * Edits are held locally and saved together. A drag emits dozens of transform
 * events per second, and writing each one would be both a wasteful number of
 * requests and an undo history nobody asked for.
 */
export function SceneComposer({
  orgId,
  venueId,
  sceneId,
  sceneTitle,
  sceneState,
  layers,
  available,
  proxies,
  objects,
}: {
  orgId: string;
  venueId: string;
  sceneId: string;
  sceneTitle: string;
  sceneState: string;
  languages: string[];
  defaultLanguage: string;
  layers: Layer[];
  available: { id: string; label: string }[];
  proxies: Proxy[];
  objects: { id: string; label: string }[];
}) {
  const router = useRouter();
  const viewerRef = useRef<{
    selectLayer: (id: string | null) => void;
    focusLayer: (id: string) => void;
    setGizmoMode: (m: "translate" | "rotate" | "scale") => void;
  } | null>(null);

  const [mode, setMode] = useState<"layers" | "proxies">("layers");
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Map<string, Transform>>(new Map());
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const base = `/org/${orgId}/venues/${venueId}`;
  const renderable = layers.filter((l) => l.url);

  const onTransformLayer = useCallback((id: string, t: Transform) => {
    setDirty((prev) => new Map(prev).set(id, t));
  }, []);

  function select(id: string | null) {
    setSelected(id);
    viewerRef.current?.selectLayer(id);
  }

  async function save() {
    if (dirty.size === 0) return;
    setBusy(true);
    try {
      const results = await Promise.all(
        [...dirty.entries()].map(([id, transform]) =>
          fetch(`/api/venues/${venueId}/scenes/${sceneId}/layers/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transform }),
          }),
        ),
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.error(`${failed} of ${results.length} positions did not save.`);
        return;
      }
      toast.success(
        dirty.size === 1 ? "Position saved." : `${dirty.size} positions saved.`,
      );
      setDirty(new Map());
      router.refresh();
    } catch {
      toast.error("Could not save. Your arrangement is still on screen.");
    } finally {
      setBusy(false);
    }
  }

  async function addLayer(representationId: string) {
    setAdding(true);
    try {
      const res = await fetch(
        `/api/venues/${venueId}/scenes/${sceneId}/layers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            representationId,
            role: renderable.length === 0 ? "base" : "object",
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Could not add that to the scene.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Could not add that to the scene.");
    } finally {
      setAdding(false);
    }
  }

  async function removeLayer(layerId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/venues/${venueId}/scenes/${sceneId}/layers/${layerId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error("Could not remove that from the scene.");
        return;
      }
      // The file itself is untouched — only its place in this scene is gone.
      toast.success("Removed from the scene. The file is still in Files.");
      setDirty((prev) => {
        const next = new Map(prev);
        next.delete(layerId);
        return next;
      });
      if (selected === layerId) select(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col px-6 py-6 md:px-10 lg:h-full">
      <Link
        href={`${base}/scenes`}
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={13} strokeWidth={1.8} aria-hidden />
        Scenes
      </Link>

      <PageHeader
        title={`${sceneTitle}.`}
        lede="Click a model to select it, then drag the handles to move it. What you see here is what a visitor sees."
        actions={
          <div className="flex items-center gap-2">
            {dirty.size > 0 ? (
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={13} strokeWidth={2} aria-hidden className="animate-spin" />
                ) : (
                  <Save size={13} strokeWidth={2} aria-hidden />
                )}
                Save {dirty.size} change{dirty.size === 1 ? "" : "s"}
              </button>
            ) : null}
            {sceneState === "published" ? (
              <Link
                href={`${base}/scenes`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-soft px-4 py-2 text-xs text-text-secondary transition hover:bg-surface-2"
              >
                Scene settings
                <ExternalLink size={11} strokeWidth={1.8} aria-hidden />
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Mode switch. Named by the job, not by the data type — "Arrange" and
          "Points of interest", never "layers" and "proxies". */}
      <div
        role="tablist"
        aria-label="What clicking does"
        className="mb-4 inline-flex rounded-full bg-surface-2 p-1"
      >
        {(
          [
            ["layers", "Arrange", Move3d],
            ["proxies", "Points of interest", Target],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              select(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              mode === value
                ? "bg-bg text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <Icon size={12} strokeWidth={1.9} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* `min-h-0` is load-bearing: a flex child defaults to min-height:auto,
          which refuses to shrink below its content and lets the canvas push
          the page taller instead of fitting inside it. */}
      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_320px]">
        <div className="h-[55vh] min-h-[320px] lg:h-full lg:min-h-0">
          {renderable.length > 0 ? (
            <ViewerCanvas
              key={renderable.map((l) => l.url).join("|")}
              layers={renderable.map((l) => ({
                id: l.id,
                url: l.url as string,
                transform: l.transform ?? undefined,
              }))}
              proxies={mode === "proxies" ? proxies : []}
              showProxies={mode === "proxies"}
              editable
              mode={mode}
              // 0 means "fill the parent". The viewer sizes itself to the box
              // it is given, so the layout decides how tall it is rather than
              // the component guessing a number that is wrong on every screen
              // except the one it was written on.
              height={0}
              className="h-full"
              label={`Editing ${sceneTitle}`}
              onSelectLayer={setSelected}
              onTransformLayer={onTransformLayer}
              onViewerReady={(v) => {
                viewerRef.current = v as unknown as typeof viewerRef.current;
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-line-soft p-12 text-center">
              <p className="text-sm text-text-primary">
                Nothing in this scene yet.
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-text-tertiary">
                Add an item from the list on the right. Only items with a
                processed 3D model can be placed — a photo or a record without a
                file has nothing to show here.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <section>
            <h2 className="mb-2.5 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
              In this scene
            </h2>
            {renderable.length === 0 ? (
              <p className="text-sm text-text-tertiary">Empty.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {renderable.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        select(l.id);
                        viewerRef.current?.focusLayer(l.id);
                      }}
                      className={`min-w-0 flex-1 truncate text-left text-sm transition ${
                        selected === l.id
                          ? "text-accent"
                          : "text-text-primary hover:text-accent"
                      }`}
                    >
                      {l.label}
                      {dirty.has(l.id) ? (
                        <span className="ml-1.5 text-[10px] text-amber-600">
                          moved
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLayer(l.id)}
                      disabled={busy}
                      aria-label={`Remove ${l.label} from this scene`}
                      className="shrink-0 rounded-full p-1 text-text-tertiary transition hover:bg-surface-2 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={13} strokeWidth={1.8} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2.5 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
              Add an item
            </h2>
            {available.length === 0 ? (
              <p className="text-xs leading-relaxed text-text-tertiary">
                Everything with a processed 3D model is already in this scene.{" "}
                <Link href={`${base}/items/new`} className="text-accent hover:underline">
                  Add another item
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-1">
                {available.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => addLayer(a.id)}
                      disabled={adding}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary disabled:opacity-50"
                    >
                      <Plus size={12} strokeWidth={2} aria-hidden className="shrink-0" />
                      <span className="min-w-0 truncate">{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {mode === "proxies" ? (
            <section>
              <h2 className="mb-2.5 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
                Points of interest
              </h2>
              <p className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-text-tertiary">
                <Crosshair size={12} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0" />
                Click anywhere on the model to place one. Full editing —
                labels, what tapping does, which item it points at — is on the{" "}
                <Link href={`${base}/proxies?scene=${sceneId}`} className="text-accent hover:underline">
                  points screen
                </Link>
                .
              </p>
              {proxies.length === 0 ? (
                <p className="text-sm text-text-tertiary">None placed yet.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {proxies.map((p) => (
                    <li key={p.id} className="py-2 text-sm text-text-primary">
                      {p.label}
                      {p.invalidatedAt ? (
                        <span className="ml-1.5 text-[10px] text-amber-600">
                          needs re-checking
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {objects.length > 0 && mode === "layers" ? (
            <p className="text-xs leading-relaxed text-text-tertiary">
              Moving something here changes where it sits in this scene only.
              The item and its file are untouched, and the same model can sit
              in several scenes at different positions.
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
