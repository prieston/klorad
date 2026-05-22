import type { ComponentProps, ComponentType, ReactNode } from "react";
import { cn } from "../utils/cn";

/**
 * A waypoint shown in the wayfinding card. Verticals pass whatever
 * shape they like — a campus room, a transit stop, a heritage site
 * waypoint — as long as it resolves to a `label` and optional icon.
 *
 * Picking happens upstream of the panel (search drawer, map click,
 * "current location"). The panel only renders the current selection
 * and emits callbacks when the user wants to edit/swap/clear.
 */
export interface WayfindingPoint {
  label: string;
  sublabel?: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface WayfindingSummary {
  /** Total walking distance in metres. */
  distanceM: number;
  /** Total estimated duration in seconds. */
  durationS: number;
  /** Number of distinct floors traversed (1 if no level change). */
  floorsTouched: number;
}

export interface WayfindingPanelProps extends Omit<ComponentProps<"div">, "onSubmit"> {
  from: WayfindingPoint | null;
  to: WayfindingPoint | null;
  /** Step-free mode toggle. */
  stepFree: boolean;
  onStepFreeChange: (value: boolean) => void;
  /** Click "From" pill → edit (open search drawer, etc.). */
  onEditFrom?: () => void;
  /** Click "To" pill → edit. */
  onEditTo?: () => void;
  /** Swap the two endpoints. */
  onSwap?: () => void;
  /**
   * The action CTA — typically "Get directions" before a route is
   * computed, "Start navigation" after.
   */
  onAction?: () => void;
  /** Action button label. Defaults: route ? "Start" : "Get directions". */
  actionLabel?: string;
  /** Disable the action button (e.g. while routing in-flight). */
  actionDisabled?: boolean;
  /** Summary card shown once the route is computed. */
  summary?: WayfindingSummary | null;
  /** Optional inline error (no route found, step-free blocked, etc.). */
  error?: string | null;
  /** Extra content (e.g. floor-by-floor breakdown) below the summary. */
  children?: ReactNode;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return "< 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} h` : `${hours} h ${rem} min`;
}

/**
 * The wayfinding control panel — two endpoint pills, a swap button,
 * a step-free toggle, an action CTA, and (when computed) a summary
 * card.
 *
 * Visual language: glass + accent, matches the rest of the Klorad
 * DS. Reusable across every vertical that does wayfinding because
 * nothing here is campus-specific.
 */
export function WayfindingPanel({
  from,
  to,
  stepFree,
  onStepFreeChange,
  onEditFrom,
  onEditTo,
  onSwap,
  onAction,
  actionLabel,
  actionDisabled,
  summary,
  error,
  children,
  className,
  ...props
}: WayfindingPanelProps) {
  const computedLabel =
    actionLabel ?? (summary ? "Start navigation" : "Get directions");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface-1/95 p-4 shadow-glass backdrop-blur",
        className,
      )}
      {...props}
    >
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <PointPill
            point={from}
            placeholder="Choose start"
            onClick={onEditFrom}
            kind="from"
          />
          <PointPill
            point={to}
            placeholder="Choose destination"
            onClick={onEditTo}
            kind="to"
          />
        </div>
        {onSwap ? (
          <button
            type="button"
            onClick={onSwap}
            aria-label="Swap start and destination"
            className="grid h-8 w-8 self-center place-items-center rounded-full border border-line-soft bg-bg text-text-secondary transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <SwapIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={stepFree}
          onChange={(e) => onStepFreeChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-line-soft accent-accent"
        />
        Step-free route only
      </label>

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2 text-xs text-text-primary">
          <span className="font-medium text-accent">
            {formatDuration(summary.durationS)}
          </span>
          <span>·</span>
          <span>{formatDistance(summary.distanceM)}</span>
          <span>·</span>
          <span>
            {summary.floorsTouched} {summary.floorsTouched === 1 ? "floor" : "floors"}
          </span>
        </div>
      ) : null}

      {children}

      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled || !from || !to}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
          actionDisabled || !from || !to
            ? "bg-surface-2 text-text-tertiary"
            : "bg-accent text-accent-contrast hover:bg-accent-hover",
        )}
      >
        {computedLabel}
      </button>
    </div>
  );
}

function PointPill({
  point,
  placeholder,
  onClick,
  kind,
}: {
  point: WayfindingPoint | null;
  placeholder: string;
  onClick?: () => void;
  kind: "from" | "to";
}) {
  const Icon = point?.icon;
  const disabled = !onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-2 rounded-xl border border-line-soft bg-bg px-3 py-2 text-left transition-colors",
        disabled ? "cursor-default" : "hover:bg-accent-soft",
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full",
          kind === "from"
            ? "border border-line-soft bg-surface-2 text-text-tertiary"
            : "bg-accent text-accent-contrast",
        )}
      >
        {Icon ? (
          <Icon className="h-3 w-3" />
        ) : kind === "from" ? (
          <CircleIcon className="h-2.5 w-2.5" />
        ) : (
          <PinIcon className="h-3 w-3" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {point ? (
          <>
            <span className="block truncate text-sm text-text-primary">
              {point.label}
            </span>
            {point.sublabel ? (
              <span className="block truncate text-[0.65rem] text-text-tertiary">
                {point.sublabel}
              </span>
            ) : null}
          </>
        ) : (
          <span className="block truncate text-sm text-text-tertiary">
            {placeholder}
          </span>
        )}
      </span>
    </button>
  );
}

function SwapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="5" cy="5" r="4" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C8 2 5 5 5 9c0 5.5 7 13 7 13s7-7.5 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
    </svg>
  );
}
