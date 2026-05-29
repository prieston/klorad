"use client";

import {
  Accessibility,
  ChevronLeft,
  Circle,
  Compass,
  Footprints,
  MapPin,
} from "lucide-react";
import {
  RouteEndpointPicker,
  type PickerOption,
} from "./RouteEndpointPicker";

export interface RouteStep {
  text: string;
  lat?: number;
  lng?: number;
}

const COPY = {
  en: {
    route: "Route",
    from: "FROM",
    to: "TO",
    stepFree: "Step-free route",
    min: "min",
    steps: "steps",
    getDirections: "Get directions",
    back: "Back",
    calculating: "Calculating route…",
    noRoute: "No route found.",
  },
  el: {
    route: "Διαδρομή",
    from: "ΑΠΟ",
    to: "ΠΡΟΣ",
    stepFree: "Προσβάσιμη διαδρομή",
    min: "λεπτ.",
    steps: "βήματα",
    getDirections: "Οδηγίες",
    back: "Πίσω",
    calculating: "Υπολογισμός διαδρομής…",
    noRoute: "Δεν βρέθηκε διαδρομή.",
  },
} as const;

/** Render distance: "286 m" / "1.4 km". */
function formatDistance(m?: number): string {
  if (m === undefined || Number.isNaN(m)) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatMinutes(durationS?: number, distanceM?: number): string {
  const seconds =
    durationS !== undefined && Number.isFinite(durationS)
      ? durationS
      : distanceM !== undefined && Number.isFinite(distanceM)
        ? distanceM / 1.4
        : undefined;
  if (seconds === undefined) return "";
  return `${Math.max(1, Math.round(seconds / 60))}`;
}

/**
 * Top header for the route page — back chevron + "Route" title +
 * the From/To pickers laid out side-by-side in a single row. The
 * row collapses to stacked on very narrow viewports via `flex-col
 * sm:flex-row`.
 */
export function RouteHeader({
  fromValue,
  fromLabel,
  toValue,
  toLabel,
  options,
  onChangeFrom,
  onChangeTo,
  onBack,
  locale,
}: {
  fromValue: string;
  fromLabel: string;
  toValue: string;
  toLabel: string;
  options: PickerOption[];
  onChangeFrom: (id: string) => void;
  onChangeTo: (id: string) => void;
  onBack: () => void;
  locale: "en" | "el";
}) {
  const copy = COPY[locale];
  return (
    <div className="bg-[var(--brand-page)] px-4 pt-3 pb-3 md:px-6">
      <div className="flex items-center gap-3 pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.back}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--brand-text)] shadow-sm transition-colors hover:text-[var(--brand-primary)]"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="text-lg font-semibold text-[var(--brand-text)]">
          {copy.route}
        </h1>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl bg-white sm:flex-row sm:gap-0 sm:divide-x sm:divide-solid sm:divide-[var(--brand-line)]">
        <div className="min-w-0 flex-1">
          <RouteEndpointPicker
            label={copy.from}
            icon={Circle}
            value={fromValue}
            valueLabel={fromLabel}
            options={options}
            showYourLocation
            locale={locale}
            onSelect={onChangeFrom}
          />
        </div>
        <div className="min-w-0 flex-1">
          <RouteEndpointPicker
            label={copy.to}
            icon={MapPin}
            value={toValue}
            valueLabel={toLabel}
            options={options}
            locale={locale}
            onSelect={onChangeTo}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Phase-1 panel — visible while the visitor is still configuring
 * the route. Step-free toggle + a single primary "Get directions"
 * CTA that flips the page into Phase 2 (the stats + steps view).
 *
 * Once Phase 2 is in, picker / toggle changes auto-recompute and
 * this panel stays hidden.
 */
export function RouteConfigPanel({
  accessible,
  onToggleAccessible,
  onGetDirections,
  status,
  locale,
}: {
  accessible: boolean;
  onToggleAccessible: (next: boolean) => void;
  onGetDirections: () => void;
  /** Drives the CTA's enabled state. */
  status: "idle" | "loading" | "ready" | "failed";
  locale: "en" | "el";
}) {
  const copy = COPY[locale];
  return (
    <section className="mx-auto max-w-[760px] px-4 pt-4 md:px-6">
      <button
        type="button"
        onClick={() => onToggleAccessible(!accessible)}
        aria-pressed={accessible}
        className="flex w-full items-center gap-3 rounded-full bg-white px-4 py-3 text-left transition-colors"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
            color: "var(--brand-primary)",
          }}
        >
          <Accessibility size={14} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--brand-text)]">
          {copy.stepFree}
        </span>
        <span
          aria-hidden
          className="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors"
          style={{
            backgroundColor: accessible
              ? "var(--brand-primary)"
              : "color-mix(in srgb, var(--brand-text-muted) 30%, #ffffff)",
          }}
        >
          <span
            className="absolute inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            style={{
              transform: accessible
                ? "translateX(1.125rem)"
                : "translateX(0.125rem)",
            }}
          />
        </span>
      </button>
      <button
        type="button"
        onClick={onGetDirections}
        disabled={status === "loading"}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <Compass size={16} strokeWidth={2} />
        {copy.getDirections}
      </button>
    </section>
  );
}

/**
 * Fixed-top route summary card — minutes · distance · steps and an
 * accessibility icon when the step-free toggle is on. Rendered as
 * a sibling above the scrolling steps list so it stays put while
 * the visitor scrolls the directions.
 */
export function RouteStatsCard({
  status,
  distanceM,
  durationS,
  stepCount,
  accessible,
  locale,
}: {
  status: "idle" | "loading" | "ready" | "failed";
  distanceM?: number;
  durationS?: number;
  stepCount: number;
  accessible: boolean;
  locale: "en" | "el";
}) {
  const copy = COPY[locale];
  return (
    <div className="bg-[var(--brand-page)] px-4 pt-4 pb-3 md:px-6">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
        {status === "ready" ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[var(--brand-text)]">
                {formatMinutes(durationS, distanceM)}
              </span>
              <span className="text-sm text-[var(--brand-text-muted)]">
                {copy.min}
              </span>
            </div>
            <span className="flex-1 text-sm text-[var(--brand-text-muted)]">
              {formatDistance(distanceM)}
              {stepCount > 0 ? ` · ${stepCount} ${copy.steps}` : ""}
            </span>
            {accessible ? (
              <span
                aria-label={copy.stepFree}
                title={copy.stepFree}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                  color: "var(--brand-primary)",
                }}
              >
                <Accessibility size={14} strokeWidth={2} />
              </span>
            ) : null}
          </>
        ) : status === "failed" ? (
          <span className="text-sm text-[var(--brand-text-muted)]">
            {copy.noRoute}
          </span>
        ) : (
          <span className="text-sm text-[var(--brand-text-muted)]">
            {copy.calculating}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Scrollable step list — each row is a button so the visitor can
 * tap to centre the map on that step's coordinate. Active row
 * (last tapped) highlights with the brand tint + border, same
 * style as the buildings list.
 */
export function RouteStepsList({
  steps,
  activeIndex,
  onSelectStep,
  locale,
  status,
}: {
  steps: RouteStep[];
  activeIndex: number;
  onSelectStep: (index: number) => void;
  locale: "en" | "el";
  status: "idle" | "loading" | "ready" | "failed";
}) {
  const copy = COPY[locale];
  if (steps.length === 0) {
    if (status === "failed") {
      return (
        <section className="mx-auto max-w-[760px] px-4 md:px-6">
          <p className="rounded-2xl bg-white p-4 text-sm text-[var(--brand-text-muted)]">
            {copy.noRoute}
          </p>
        </section>
      );
    }
    return null;
  }
  return (
    <section className="mx-auto max-w-[760px] px-4 md:px-6">
      <ul className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const active = i === activeIndex;
          const hasCoord = step.lat !== undefined && step.lng !== undefined;
          return (
            <li key={`${step.text}-${i}`}>
              <button
                type="button"
                onClick={() => onSelectStep(i)}
                disabled={!hasCoord}
                aria-current={active ? "true" : undefined}
                className="flex w-full items-start gap-3 rounded-2xl border border-solid px-3 py-3 text-left transition-colors disabled:cursor-default"
                style={
                  active
                    ? {
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-primary) 7%, #ffffff)",
                        borderColor: "var(--brand-primary)",
                      }
                    : {
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-primary) 3%, #ffffff)",
                        borderColor: "transparent",
                      }
                }
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                    color: "var(--brand-primary)",
                  }}
                >
                  <Footprints size={16} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--brand-text)]">
                  {step.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
