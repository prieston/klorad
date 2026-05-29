"use client";

import { useMemo } from "react";
import { deriveCampusPalette, type CampusPalette } from "@/lib/palette";

interface Props {
  /** Primary hex (e.g. "#534AB7"). Empty / invalid → platform purple. */
  primary: string | null | undefined;
}

type SwatchKey = keyof CampusPalette;

const SWATCHES: Array<{ key: SwatchKey; label: string; hint: string }> = [
  { key: "primary", label: "Primary", hint: "Icons + links" },
  { key: "primaryFill", label: "Fill", hint: "Hero + CTAs" },
  { key: "primaryBg", label: "Surface", hint: "Soft chips" },
  { key: "primarySoft", label: "Tint", hint: "Hover + active" },
  { key: "primaryInk", label: "Ink", hint: "Deep contrast" },
  { key: "accentWarm", label: "Accent warm", hint: "Today + events" },
  { key: "accentCool", label: "Accent cool", hint: "Calm surfaces" },
  { key: "accentComplement", label: "Complement", hint: "Callouts" },
];

/**
 * Live palette preview for the Settings → Branding section. Reads
 * the current "Primary color" input and renders the eight derived
 * tokens as labelled swatches with their computed hex values, so
 * the rector sees the full palette their campus will use *before*
 * saving. Recomputes the moment the primary changes.
 *
 * No DB call — the entire derivation is in-memory via
 * `lib/palette.ts`, so the preview tracks an unsaved draft.
 */
export function PalettePreview({ primary }: Props) {
  const palette = useMemo(() => deriveCampusPalette(primary), [primary]);

  return (
    <div className="rounded-xl border border-solid border-line-soft bg-surface-2 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          Generated palette
        </span>
        <span className="text-[10px] text-text-tertiary">
          Auto-derived from primary
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SWATCHES.map((s) => {
          const color = palette[s.key];
          return (
            <div key={s.key} className="flex flex-col gap-1.5">
              <span
                aria-hidden
                className="h-12 rounded-lg border border-solid border-line-soft"
                style={{ backgroundColor: color }}
              />
              <div className="leading-tight">
                <div className="text-xs font-medium text-text-primary">
                  {s.label}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                  {color}
                </div>
                <div className="mt-0.5 text-[10px] text-text-tertiary">
                  {s.hint}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
