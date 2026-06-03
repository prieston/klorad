"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Check,
  Pencil,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";
import { Button, Field, Input, Panel } from "@klorad/design-system";
import { AnchorPicker, type AnchorValue } from "@/lib/admin/AnchorPicker";
import {
  MAX_SAVED_ROUTES,
  parseSavedRoutes,
  type SavedRoute,
} from "@/lib/saved-routes";

interface Props {
  mapId: string;
}

interface MapResponse {
  id: string;
  sceneData?: Record<string, unknown>;
}

interface SceneShape {
  indoorMapId?: string;
  savedRoutes?: unknown;
  [k: string]: unknown;
}

const fetcher = (url: string): Promise<MapResponse> =>
  fetch(url).then((r) => r.json());

interface DraftRoute {
  /** Id is empty for a brand-new draft; populated for an edit. */
  id: string;
  name: string;
  nameEl: string;
  from: AnchorValue;
  to: AnchorValue;
  accessible: boolean;
}

const EMPTY_ANCHOR: AnchorValue = { refName: "", refId: "" };
const EMPTY_DRAFT: DraftRoute = {
  id: "",
  name: "",
  nameEl: "",
  from: EMPTY_ANCHOR,
  to: EMPTY_ANCHOR,
  accessible: false,
};

/**
 * Authoring card for `sceneData.savedRoutes`. List on the left
 * (compact rows, edit / delete inline), draft form on the right
 * when the rector clicks "Add route" or the edit pencil. Saves
 * merge the whole `savedRoutes` array back via the existing
 * `/api/maps/[mapId]` PATCH route — same pattern as the rest of
 * sceneData (defaultLocale, klio, etc.).
 *
 * AnchorPicker handles the MappedIn space lookup for both stops.
 * When `indoorMapId` is unset we still render a disabled card so
 * the rector knows the order: link MappedIn first.
 */
export function SavedRoutesCard({ mapId }: Props) {
  const { data: server } = useSWR<MapResponse>(
    `/api/maps/${mapId}`,
    fetcher,
  );

  const scene = (server?.sceneData ?? {}) as SceneShape;
  const indoorMapId = scene.indoorMapId ?? null;
  const savedRoutes = useMemo(
    () => parseSavedRoutes(scene.savedRoutes),
    [scene.savedRoutes],
  );

  const [draft, setDraft] = useState<DraftRoute | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = async (next: SavedRoute[]) => {
    if (!server || saving) return;
    setSaving(true);
    try {
      const nextScene = { ...(server.sceneData ?? {}), savedRoutes: next };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData: nextScene }),
      });
      if (!res.ok) throw new Error("Failed");
      await globalMutate(`/api/maps/${mapId}`);
      return true;
    } catch {
      toast.error("Couldn't save routes");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the route a name");
      return;
    }
    if (!draft.from.refId || !draft.to.refId) {
      toast.error("Pick both an origin and a destination");
      return;
    }
    if (draft.from.refId === draft.to.refId) {
      toast.error("Origin and destination must be different");
      return;
    }
    const isNew = !draft.id;
    if (isNew && savedRoutes.length >= MAX_SAVED_ROUTES) {
      toast.error(`Max ${MAX_SAVED_ROUTES} saved routes per campus`);
      return;
    }
    const id = draft.id || makeId();
    const next: SavedRoute = {
      id,
      name: draft.name.trim().slice(0, 60),
      nameEl: draft.nameEl.trim() ? draft.nameEl.trim().slice(0, 60) : undefined,
      from: { refId: draft.from.refId, refName: draft.from.refName },
      to: { refId: draft.to.refId, refName: draft.to.refName },
      accessible: draft.accessible,
    };
    const ok = await persist(
      isNew
        ? [...savedRoutes, next]
        : savedRoutes.map((r) => (r.id === id ? next : r)),
    );
    if (ok) {
      setDraft(null);
      toast.success(isNew ? "Route saved" : "Route updated");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await persist(savedRoutes.filter((r) => r.id !== id));
    if (ok) toast.success("Route deleted");
  };

  const editingId = draft?.id ?? null;

  return (
    <Panel className="rounded-2xl p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Route size={16} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">
              Saved routes
            </h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Pre-computed From → To routes that students see as chips on
              the public map. Up to {MAX_SAVED_ROUTES} per campus.
            </p>
          </div>
        </div>
        {indoorMapId && !draft ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setDraft({ ...EMPTY_DRAFT })}
            disabled={savedRoutes.length >= MAX_SAVED_ROUTES}
          >
            <Plus size={12} strokeWidth={1.75} aria-hidden />
            Add route
          </Button>
        ) : null}
      </div>

      {!indoorMapId ? (
        <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
          Link a MappedIn venue first — saved routes pick from real
          MappedIn spaces.
        </div>
      ) : null}

      {indoorMapId ? (
        <div className="space-y-4">
          {savedRoutes.length > 0 ? (
            <ul className="space-y-2 list-none">
              {savedRoutes.map((r) => (
                <RouteRow
                  key={r.id}
                  route={r}
                  isEditing={editingId === r.id}
                  onEdit={() =>
                    setDraft({
                      id: r.id,
                      name: r.name,
                      nameEl: r.nameEl ?? "",
                      from: { refId: r.from.refId, refName: r.from.refName },
                      to: { refId: r.to.refId, refName: r.to.refName },
                      accessible: r.accessible,
                    })
                  }
                  onDelete={() => void handleDelete(r.id)}
                />
              ))}
            </ul>
          ) : !draft ? (
            <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
              No saved routes yet. Add one — Library → Main Cafeteria,
              say — and students see it as a chip on the public map.
            </div>
          ) : null}

          {draft ? (
            <DraftForm
              draft={draft}
              indoorMapId={indoorMapId}
              onChange={setDraft}
              onCancel={() => setDraft(null)}
              onSubmit={() => void handleSubmitDraft()}
              saving={saving}
            />
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

interface RouteRowProps {
  route: SavedRoute;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function RouteRow({ route, isEditing, onEdit, onDelete }: RouteRowProps) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border bg-surface-2/30 p-3 ${
        isEditing ? "border-accent" : "border-line-soft"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {route.name}
          {route.nameEl ? (
            <span className="ml-2 text-xs font-normal text-text-tertiary">
              · {route.nameEl}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-tertiary">
          <span>{route.from.refName}</span>
          <ArrowRight size={11} strokeWidth={1.75} aria-hidden />
          <span>{route.to.refName}</span>
          {route.accessible ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              Step-free
            </span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit route"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
      >
        <Pencil size={13} strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete route"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-500"
      >
        <Trash2 size={13} strokeWidth={1.75} aria-hidden />
      </button>
    </li>
  );
}

interface DraftFormProps {
  draft: DraftRoute;
  indoorMapId: string;
  onChange: (next: DraftRoute) => void;
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
}

function DraftForm({
  draft,
  indoorMapId,
  onChange,
  onCancel,
  onSubmit,
  saving,
}: DraftFormProps) {
  const remainingEn = 60 - draft.name.length;
  const remainingEl = 60 - draft.nameEl.length;
  return (
    <div className="space-y-4 rounded-xl border border-line-soft bg-surface-2/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Chip name · EN"
          hint={`${remainingEn} characters left`}
        >
          <Input
            value={draft.name}
            onChange={(e) =>
              onChange({ ...draft, name: e.target.value.slice(0, 60) })
            }
            placeholder="Library → Cafeteria"
            maxLength={60}
          />
        </Field>
        <Field
          label="Chip name · ΕΛ (optional)"
          hint={`${remainingEl} characters left`}
        >
          <Input
            value={draft.nameEl}
            onChange={(e) =>
              onChange({ ...draft, nameEl: e.target.value.slice(0, 60) })
            }
            placeholder="Βιβλιοθήκη → Καφέ"
            maxLength={60}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <AnchorPicker
            indoorMapId={indoorMapId}
            value={draft.from}
            onChange={(v) => onChange({ ...draft, from: v })}
            placeholder="Pick origin…"
            ariaLabel="Origin space"
          />
        </Field>
        <Field label="To">
          <AnchorPicker
            indoorMapId={indoorMapId}
            value={draft.to}
            onChange={(v) => onChange({ ...draft, to: v })}
            placeholder="Pick destination…"
            ariaLabel="Destination space"
          />
        </Field>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-1 p-3">
        <input
          type="checkbox"
          checked={draft.accessible}
          onChange={(e) =>
            onChange({ ...draft, accessible: e.target.checked })
          }
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-text-primary">
            Step-free route
          </span>
          <span className="mt-0.5 block text-xs text-text-tertiary">
            MappedIn computes the route avoiding stairs.
          </span>
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={saving}
        >
          <Check size={12} strokeWidth={1.75} aria-hidden />
          {saving ? "Saving…" : draft.id ? "Update route" : "Save route"}
        </Button>
      </div>
    </div>
  );
}

/** Cheap client-side id — no need for cuid here; routes are
 *  rector-scoped and the `id` only has to be unique within one
 *  campus's array. Random + timestamp is plenty. */
function makeId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}
