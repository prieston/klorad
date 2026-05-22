"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_WALL_THICKNESS, type Pt, type Wall } from "./types";
import {
  GRID_VISUAL,
  type SnapResult,
  dist,
  snapPoint,
} from "./geometry";

/**
 * The 2D floor-plan editor — Phase 1.
 *
 * A dedicated top-down SVG plan editor (not Mapbox — a slippy map is
 * a poor CAD surface). Phase 1 covers wall drawing with grid /
 * endpoint / ortho snapping, pan & zoom, and undo. Openings,
 * furniture, persistence, and nav-graph derivation follow in later
 * phases. State is in-memory for now.
 */

type Tool = "wall" | "pan";

const MIN_SCALE = 8; // px per metre
const MAX_SCALE = 240;

interface View {
  /** World coordinate (metres) at the SVG's top-left corner. */
  originX: number;
  originY: number;
  /** Pixels per metre. */
  scale: number;
}

export function FloorPlanEditor() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<Tool>("wall");
  const [walls, setWalls] = useState<Wall[]>([]);
  const [view, setView] = useState<View>({
    originX: -4,
    originY: -3,
    scale: 48,
  });
  const [draftStart, setDraftStart] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<SnapResult | null>(null);
  const shiftRef = useRef(false);
  const panRef = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);

  const toScreen = useCallback(
    (p: Pt) => ({
      x: (p.x - view.originX) * view.scale,
      y: (p.y - view.originY) * view.scale,
    }),
    [view],
  );

  /** Pointer event → SVG-local pixels + world point. */
  const locate = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = svgRef.current?.getBoundingClientRect();
      const sx = rect ? e.clientX - rect.left : 0;
      const sy = rect ? e.clientY - rect.top : 0;
      return {
        sx,
        sy,
        world: {
          x: sx / view.scale + view.originX,
          y: sy / view.scale + view.originY,
        } as Pt,
      };
    },
    [view],
  );

  // Wheel zoom — native non-passive listener so preventDefault works.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        const worldX = sx / v.scale + v.originX;
        const worldY = sy / v.scale + v.originY;
        return {
          scale,
          originX: worldX - sx / scale,
          originY: worldY - sy / scale,
        };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard — Shift (force ortho), Escape (end chain), Cmd/Ctrl+Z.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
      if (e.key === "Escape") setDraftStart(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setWalls((w) => w.slice(0, -1));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { sx, sy, world } = locate(e);
    if (tool === "pan" || e.button === 1) {
      panRef.current = { sx, sy, ox: view.originX, oy: view.originY };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const snap = snapPoint(world, {
      walls,
      draftStart,
      scale: view.scale,
      forceOrtho: shiftRef.current,
    });
    if (!draftStart) {
      setDraftStart(snap.pt);
      return;
    }
    if (dist(draftStart, snap.pt) > 0.01) {
      const wall: Wall = {
        id: crypto.randomUUID(),
        start: draftStart,
        end: snap.pt,
        thickness: DEFAULT_WALL_THICKNESS,
      };
      setWalls((w) => [...w, wall]);
    }
    // Chain — the end becomes the next segment's start.
    setDraftStart(snap.pt);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { sx, sy, world } = locate(e);
    if (panRef.current) {
      const p = panRef.current;
      setView((v) => ({
        ...v,
        originX: p.ox - (sx - p.sx) / v.scale,
        originY: p.oy - (sy - p.sy) / v.scale,
      }));
      return;
    }
    if (tool === "wall") {
      setCursor(
        snapPoint(world, {
          walls,
          draftStart,
          scale: view.scale,
          forceOrtho: shiftRef.current,
        }),
      );
    }
  };

  const endPan = (e: React.PointerEvent<SVGSVGElement>) => {
    if (panRef.current) {
      panRef.current = null;
      svgRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const gridPx = GRID_VISUAL * view.scale;
  const gridOffX = -view.originX * view.scale;
  const gridOffY = -view.originY * view.scale;

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-1">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: tool === "pan" ? "grab" : "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onContextMenu={(e) => {
          e.preventDefault();
          setDraftStart(null);
        }}
      >
        <defs>
          <pattern
            id="fp-grid"
            patternUnits="userSpaceOnUse"
            width={gridPx}
            height={gridPx}
            x={gridOffX}
            y={gridOffY}
          >
            <path
              d={`M ${gridPx} 0 L 0 0 0 ${gridPx}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-line-soft"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-grid)" />

        {/* Committed walls. */}
        {walls.map((w) => {
          const a = toScreen(w.start);
          const b = toScreen(w.end);
          return (
            <line
              key={w.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={Math.max(2, w.thickness * view.scale)}
              strokeLinecap="round"
              className="stroke-text-primary"
            />
          );
        })}

        {/* Wall endpoints. */}
        {walls.map((w) =>
          [w.start, w.end].map((p, i) => {
            const s = toScreen(p);
            return (
              <circle
                key={`${w.id}-${i}`}
                cx={s.x}
                cy={s.y}
                r={3}
                className="fill-text-primary"
              />
            );
          }),
        )}

        {/* In-progress segment + length readout. */}
        {draftStart && cursor
          ? (() => {
              const a = toScreen(draftStart);
              const b = toScreen(cursor.pt);
              const len = dist(draftStart, cursor.pt);
              return (
                <g>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    strokeWidth={Math.max(2, DEFAULT_WALL_THICKNESS * view.scale)}
                    strokeLinecap="round"
                    strokeDasharray="5 5"
                    className="stroke-accent"
                  />
                  {len > 0.05 ? (
                    <text
                      x={(a.x + b.x) / 2}
                      y={(a.y + b.y) / 2 - 8}
                      textAnchor="middle"
                      className="fill-accent text-[11px] font-semibold"
                    >
                      {len.toFixed(2)} m
                    </text>
                  ) : null}
                </g>
              );
            })()
          : null}

        {/* Snap cursor indicator. */}
        {tool === "wall" && cursor
          ? (() => {
              const s = toScreen(cursor.pt);
              const fill =
                cursor.kind === "endpoint"
                  ? "fill-accent"
                  : cursor.kind === "ortho"
                    ? "fill-accent"
                    : "fill-text-tertiary";
              return (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={cursor.kind === "endpoint" ? 7 : 4.5}
                  className={`${fill} stroke-surface-1`}
                  strokeWidth={2}
                />
              );
            })()
          : null}
      </svg>

      {/* Toolbar. */}
      <div className="absolute left-4 top-4 flex items-center gap-1 rounded-xl bg-surface-1/95 p-1.5 shadow-glass backdrop-blur">
        <ToolButton
          active={tool === "wall"}
          label="Wall"
          onClick={() => setTool("wall")}
        />
        <ToolButton
          active={tool === "pan"}
          label="Pan"
          onClick={() => {
            setTool("pan");
            setDraftStart(null);
          }}
        />
        <div className="mx-1 h-5 w-px bg-line-soft" />
        <ToolButton
          active={false}
          label="Undo"
          disabled={walls.length === 0}
          onClick={() => setWalls((w) => w.slice(0, -1))}
        />
        <span className="px-2 text-xs text-text-tertiary">
          {walls.length} wall{walls.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Hint. */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-surface-1/95 px-4 py-1.5 text-xs text-text-secondary shadow-glass backdrop-blur">
        Click to place wall points · Esc / right-click ends · Shift forces
        straight · scroll to zoom
      </div>
    </div>
  );
}

function ToolButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={
        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 " +
        (active
          ? "bg-accent text-accent-contrast"
          : "text-text-secondary hover:bg-accent-soft hover:text-accent")
      }
    >
      {label}
    </button>
  );
}
