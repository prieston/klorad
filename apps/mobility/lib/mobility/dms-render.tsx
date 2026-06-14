"use client";

/**
 * DMS face renderer — paint the NTCIP MULTI-parsed pages as a
 * reasonable approximation of the physical sign. Amber-on-black,
 * one page at a time, auto-cycling when the message has multiple
 * pages.
 *
 * Per-line / per-page justification respected; colour markers ([cf])
 * map to a small palette (amber default, red/green/yellow for the
 * standard NTCIP indices). Brightness comes from `status.brightness`
 * (0-100) and dims the foreground.
 */
import { useEffect, useState } from "react";
import { parseMulti, type DmsLine } from "@klorad/connectors/inet-atms";

const NTCIP_PALETTE: Record<number, string> = {
  1: "#000000",
  2: "#ff0000",
  3: "#ffff00",
  4: "#00ff00",
  5: "#00ffff",
  6: "#0000ff",
  7: "#ff00ff",
  8: "#ffffff",
  9: "#ffa500",
};

function justifyClass(j: number | null): string {
  switch (j) {
    case 1:
      return "text-left";
    case 2:
      return "text-center";
    case 3:
      return "text-right";
    default:
      return "text-center";
  }
}

function pageJustifyClass(j: number | null): string {
  switch (j) {
    case 1:
      return "justify-start";
    case 2:
      return "justify-center";
    case 3:
      return "justify-end";
    default:
      return "justify-center";
  }
}

export interface DmsFaceProps {
  /** Raw MULTI string from `status.message`. */
  multi: string;
  /** Sign capability — controls the grid size. Falls back to 3 x 16. */
  maxLinesPerPage?: number;
  maxCharsPerLine?: number;
  /** 0-100, dims the amber foreground. Defaults to 100 (full). */
  brightness?: number;
}

export function DmsFace({
  multi,
  maxLinesPerPage = 3,
  maxCharsPerLine = 16,
  brightness = 100,
}: DmsFaceProps) {
  const parsed = parseMulti(multi);
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    if (parsed.pages.length <= 1) return;
    const tick = setInterval(() => {
      setPageIdx((i) => (i + 1) % parsed.pages.length);
    }, 3000);
    return () => clearInterval(tick);
  }, [parsed.pages.length]);

  if (parsed.pages.length === 0) {
    return (
      <div className="rounded-md bg-black p-4 font-mono text-amber-400">
        (no message)
      </div>
    );
  }

  const page = parsed.pages[pageIdx]!;
  const lines: (DmsLine | null)[] = [
    ...page.lines,
    ...Array.from({ length: Math.max(0, maxLinesPerPage - page.lines.length) }).map(
      () => null,
    ),
  ].slice(0, maxLinesPerPage);

  const dimmed = Math.max(0.2, Math.min(1, brightness / 100));

  return (
    <div
      className={`flex flex-col rounded-md bg-black px-4 py-3 font-mono leading-tight tracking-[0.15em] ${pageJustifyClass(page.justify)}`}
      style={{
        // 0.75rem per char wide approximation; ratio of 0.7 width-to-height.
        minWidth: `${maxCharsPerLine * 0.85}rem`,
        opacity: dimmed,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className={`${justifyClass(line?.justify ?? page.justify ?? null)}`}
          style={{
            color: line?.colour
              ? (NTCIP_PALETTE[line.colour] ?? "#ffa500")
              : "#ffa500",
          }}
        >
          {(line?.text ?? "").slice(0, maxCharsPerLine).padEnd(maxCharsPerLine, " ")}
        </div>
      ))}
      {parsed.pages.length > 1 && (
        <div className="mt-2 text-[10px] text-amber-300/50 uppercase tracking-[0.3em]">
          {pageIdx + 1} / {parsed.pages.length}
        </div>
      )}
    </div>
  );
}
