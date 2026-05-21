import type { ComponentProps } from "react";
import { cn } from "../utils/cn";

/**
 * Format an integer floor as a short pill label.
 *
 *   0   → "G"   (ground floor)
 *   n>0 → "{n}" (above ground)
 *   n<0 → "B{|n|}" (basement)
 *
 * Verticals that don't use the conventional building-floor numbering
 * (route levels for Mobility, archaeology layers for Heritage, zoning
 * tiers for Urban) pass their own `formatLabel`.
 */
export function defaultFloorLabel(n: number): string {
  if (n === 0) return "G";
  if (n > 0) return String(n);
  return `B${Math.abs(n)}`;
}

export type FloorSwitcherProps = Omit<ComponentProps<"div">, "onChange"> & {
  /**
   * The set of selectable floors, as integers. The component does not
   * sort them — pass them in the order you want them stacked. The
   * canonical order on a building is "highest at top, basement at
   * bottom", which means descending.
   */
  floors: number[];
  /** The currently focused floor. `null` means "show all floors stacked". */
  activeFloor: number | null;
  /**
   * Fires when the user picks a different floor. `null` is fired by
   * the "All" pill and means "clear the focus".
   */
  onChange: (floor: number | null) => void;
  /** Optional label formatter — defaults to {@link defaultFloorLabel}. */
  formatLabel?: (floor: number) => string;
  /** Optional label for the "show all floors" pill. Defaults to "All". */
  allLabel?: string;
  /**
   * When true, the "All" pill is hidden — useful for surfaces where
   * the parent always wants a single floor in focus (e.g. a tightly
   * scoped drill-down view).
   */
  hideAllPill?: boolean;
};

/**
 * A vertical stack of pills for switching between floors of a
 * building — the standard "floor selector" pattern on Apple Maps /
 * Google Maps / Mappedin. Position-agnostic: the caller decides
 * whether to anchor it top-right of a map, dock it inside a panel,
 * or render it inline.
 *
 * Reusable across every Klorad vertical because nothing here is
 * building-specific — the same primitive renders Mobility's route
 * levels and Heritage's archaeology layers with a different
 * `formatLabel`.
 */
export function FloorSwitcher({
  floors,
  activeFloor,
  onChange,
  formatLabel = defaultFloorLabel,
  allLabel = "All",
  hideAllPill = false,
  className,
  ...props
}: FloorSwitcherProps) {
  if (floors.length === 0) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Floor selector"
      className={cn(
        "flex flex-col gap-1 rounded-full border border-line-soft bg-surface-1/95 p-1 shadow-glass backdrop-blur",
        className,
      )}
      {...props}
    >
      {floors.map((floor) => {
        const active = activeFloor === floor;
        return (
          <button
            key={floor}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(floor)}
            className={cn(
              "h-8 w-8 rounded-full text-xs font-medium tabular-nums transition-colors",
              active
                ? "bg-accent text-accent-contrast"
                : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
            )}
          >
            {formatLabel(floor)}
          </button>
        );
      })}
      {hideAllPill ? null : (
        <button
          type="button"
          role="radio"
          aria-checked={activeFloor === null}
          onClick={() => onChange(null)}
          className={cn(
            "h-8 w-8 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider transition-colors",
            activeFloor === null
              ? "bg-accent text-accent-contrast"
              : "text-text-tertiary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          {allLabel}
        </button>
      )}
    </div>
  );
}
