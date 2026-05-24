"use client";

import { useState } from "react";
import { Button } from "@klorad/design-system";
import { translate, type Locale } from "@/app/lib/i18n-core";
import { SearchableSelect } from "./SearchableSelect";

/** A selectable destination — a named space in the venue. */
export interface SpaceOption {
  id: string;
  name: string;
  /** MappedIn space type (e.g. "office", "cafe") — used by the chip filter. */
  type?: string;
  /** Floor-stack id this space belongs to — used to filter to the active building. */
  buildingId?: string;
}

export interface WayfindingControlsProps {
  /** Named spaces in the venue, used to populate the pickers. */
  spaces: SpaceOption[];
  /** A route request is in flight. */
  routing: boolean;
  /** Inline error (no route, routing failed). */
  error: string | null;
  /** Inline route summary — "120 m · ~2 min" — shown after a draw. */
  summary?: string | null;
  /** Turn-by-turn instructions from the SDK, shown under the summary. */
  instructions?: string[];
  /**
   * Compute + draw a route between two spaces. `accessible` requests
   * MappedIn's step-free route — stairs avoided where alternatives exist.
   */
  onRoute: (fromId: string, toId: string, accessible: boolean) => void;
  /**
   * Whether the route should be step-free. Controlled — the parent
   * (NavigateTab) owns the routing profile (Default / Wheelchair /
   * Visually impaired) and maps it to this flag.
   */
  accessible?: boolean;
  /** Clear the drawn route. */
  onClear: () => void;
  /** UI locale — defaults to English. */
  locale?: Locale;
  /** Drop the rounded-card chrome — for use inside the side panel. */
  bare?: boolean;
}

/**
 * The indoor directions panel — a floating glass card over the
 * MappedIn viewer. Purely presentational: it holds the two pickers'
 * local state and emits `onRoute` / `onClear`; the viewer owns the
 * SDK calls. Lives inside `lib/mappedin/` so the MappedIn surface
 * stays one isolated folder.
 */
export function WayfindingControls({
  spaces,
  routing,
  error,
  summary,
  instructions,
  onRoute,
  onClear,
  locale = "en",
  bare = false,
  accessible = false,
}: WayfindingControlsProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const canRoute = from !== "" && to !== "" && from !== to && !routing;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };
  const clearAll = () => {
    setFrom("");
    setTo("");
    onClear();
  };

  return (
    <div
      className={
        bare
          ? "flex w-full flex-col gap-3"
          : "flex w-full flex-col gap-3 rounded-2xl border border-line-soft bg-surface-1/95 p-4 shadow-glass backdrop-blur"
      }
    >
      <h2 className="text-sm font-semibold text-text-primary">
        {t("mappedin.wayfindTitle")}
      </h2>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          {t("mappedin.wayfindFrom")}
        </span>
        <SearchableSelect
          options={spaces}
          value={from}
          onChange={setFrom}
          placeholder={t("mappedin.wayfindPick")}
          noMatchLabel={t("mappedin.noMatches")}
          ariaLabel={t("mappedin.wayfindFrom")}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          {t("mappedin.wayfindTo")}
        </span>
        <SearchableSelect
          options={spaces}
          value={to}
          onChange={setTo}
          placeholder={t("mappedin.wayfindPick")}
          noMatchLabel={t("mappedin.noMatches")}
          ariaLabel={t("mappedin.wayfindTo")}
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {summary && !error ? (
        <p className="text-xs font-medium text-accent">{summary}</p>
      ) : null}
      {instructions && instructions.length > 0 && !error ? (
        <ol className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-surface-2 p-2 text-xs text-text-secondary">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold text-accent">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={swap}
            disabled={!from && !to}
          >
            ↑↓ {t("mappedin.swap")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={clearAll}
            disabled={!from && !to}
          >
            ✕ {t("mappedin.wayfindClear")}
          </Button>
        </div>
        <Button
          size="sm"
          disabled={!canRoute}
          onClick={() => onRoute(from, to, accessible)}
        >
          {routing
            ? t("mappedin.wayfindRouting")
            : t("mappedin.wayfindGo")}
        </Button>
      </div>
    </div>
  );
}
