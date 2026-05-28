"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/lib/mappedin/SearchableSelect";

export interface AnchorValue {
  refName: string;
  refId: string;
}

interface MappedinSpaceLite {
  id: string;
  name: string;
}

export interface AnchorPickerProps {
  /** MappedIn venue id from sceneData.indoorMapId. When unset, falls back to free text. */
  indoorMapId?: string | null;
  value: AnchorValue;
  onChange: (v: AnchorValue) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Anchor picker for the admin authoring surfaces.
 *
 * When the campus has a MappedIn venue (`indoorMapId` set), loads
 * the spaces client-side and renders a `SearchableSelect` so the
 * admin picks a real room — the resulting `{ refId, refName }`
 * makes "Get directions" deep-links on the public side land on the
 * right space.
 *
 * Without a MappedIn venue, falls back to a plain text input — the
 * `refName` still drives the chip on the public surface, but
 * `refId` stays empty (no deep-link).
 *
 * Legacy rows with `refName` but no `refId` are upgraded on first
 * render: if an exact-name match exists in the loaded spaces, the
 * id is filled in silently.
 */
export function AnchorPicker({
  indoorMapId,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: AnchorPickerProps) {
  const [spaces, setSpaces] = useState<MappedinSpaceLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load MappedIn spaces client-side; the SDK isn't safe in the
  // server bundle (the workbench dynamic-imports it for the same
  // reason). Reuses the publishable NEXT_PUBLIC_MAPPEDIN_* creds.
  useEffect(() => {
    if (!indoorMapId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { getMapData } = await import("@mappedin/mappedin-js");
        const { resolveVenue } = await import("@/lib/mappedin/config");
        const venue = resolveVenue();
        const mapData = await getMapData({
          key: venue.key,
          secret: venue.secret,
          mapId: indoorMapId,
        });
        const list = mapData
          .getByType("space")
          .filter((s) => Boolean(s.name))
          .map((s) => ({ id: s.id, name: s.name as string }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setSpaces(list);
      } catch (err) {
        console.error("[AnchorPicker] failed to load spaces", err);
        if (!cancelled) setError("Couldn't load rooms");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [indoorMapId]);

  // Legacy-row upgrade: if we got an old anchor with a name but no
  // id and one of the loaded spaces matches by name, fill the id.
  useEffect(() => {
    if (!value.refName || value.refId || spaces.length === 0) return;
    const match = spaces.find(
      (s) => s.name.toLowerCase() === value.refName.toLowerCase(),
    );
    if (match) onChange({ refName: match.name, refId: match.id });
    // We intentionally don't depend on `onChange` — only run when
    // the inputs to the match change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces, value.refName, value.refId]);

  const selectOptions = useMemo(
    () => spaces.map((s) => ({ id: s.id, name: s.name })),
    [spaces],
  );

  // Free-text fallback when there's no MappedIn venue connected.
  if (!indoorMapId) {
    return (
      <input
        type="text"
        value={value.refName}
        onChange={(e) =>
          onChange({ refName: e.target.value, refId: "" })
        }
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-md border border-solid border-line-soft bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <SearchableSelect
        options={selectOptions}
        value={value.refId}
        onChange={(refId) => {
          const picked = spaces.find((s) => s.id === refId);
          if (picked) onChange({ refName: picked.name, refId: picked.id });
        }}
        placeholder={
          loading
            ? "Loading rooms…"
            : error
              ? error
              : (placeholder ?? "Pick a room")
        }
        searchPlaceholder="Search rooms…"
        ariaLabel={ariaLabel}
      />
      {/* Surface a non-fatal load error inline; user can still save
          a row without an anchor. */}
      {error ? (
        <span className="text-[0.7rem] text-text-tertiary">
          Couldn’t load MappedIn rooms — leave anchor blank or retry.
        </span>
      ) : null}
    </div>
  );
}
