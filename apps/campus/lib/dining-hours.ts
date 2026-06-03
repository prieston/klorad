/**
 * Structured weekly hours for `DiningLocation`.
 *
 * Stored as a JSON array on `DiningLocation.hours`. Each row is one
 * shift on one day (Sun=0..Sat=6); a kitchen with split shifts has
 * multiple rows for the same day. Close times after midnight wrap
 * past `24:00` by passing e.g. `26:30` — much easier to reason about
 * than spilling the row into the next day.
 *
 * Pure functions here: no Prisma, no React. Imported from both the
 * dashboard authoring screen and the public list.
 */

/** Sunday = 0 through Saturday = 6 — matches `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** One open / close pair on one day, both in `HH:mm` 24-hour. The
 *  close can be 24:00 or later to model past-midnight kitchens. */
export interface HoursShift {
  day: Weekday;
  open: string;
  close: string;
}

export type WeeklyHours = HoursShift[];

const WEEKDAY_NAMES_EN: Record<Weekday, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const WEEKDAY_NAMES_EL: Record<Weekday, string> = {
  0: "Κυρ",
  1: "Δευ",
  2: "Τρι",
  3: "Τετ",
  4: "Πεμ",
  5: "Παρ",
  6: "Σαβ",
};

const TIME_RE = /^\d{2}:\d{2}$/;

/** Narrow an unknown JSON blob (Prisma returns `JsonValue`) to a
 *  validated `WeeklyHours`. Anything malformed is silently filtered;
 *  a partly-broken row is better than a 500. */
export function parseHours(value: unknown): WeeklyHours {
  if (!Array.isArray(value)) return [];
  const out: WeeklyHours = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const day = e.day;
    const open = e.open;
    const close = e.close;
    if (
      typeof day !== "number" ||
      !Number.isInteger(day) ||
      day < 0 ||
      day > 6 ||
      typeof open !== "string" ||
      typeof close !== "string" ||
      !TIME_RE.test(open) ||
      !TIME_RE.test(close)
    ) {
      continue;
    }
    out.push({ day: day as Weekday, open, close });
  }
  out.sort((a, b) => a.day - b.day || a.open.localeCompare(b.open));
  return out;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Is the dining location currently open? `now` defaults to the
 * server's wall clock; the public page calls this server-side so the
 * cached SSR answer matches the user's first paint.
 *
 * Past-midnight shifts close > 24:00) extend into the next day's
 * minute math automatically. A 02:00 close on Friday is matched at
 * 01:30 Saturday by the previous day's Fri/Sat shift.
 */
export function isOpenAt(hours: WeeklyHours, now: Date): boolean {
  if (hours.length === 0) return false;
  const day = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const h of hours) {
    if (h.day === day) {
      if (nowMins >= minutes(h.open) && nowMins < minutes(h.close)) {
        return true;
      }
    }
    // Past-midnight catch: a shift opened on the prior day with close
    // > 24:00 spills into today.
    const prevDay = (day + 6) % 7;
    if (h.day === prevDay && minutes(h.close) > 24 * 60) {
      const spilloverMins = minutes(h.close) - 24 * 60;
      if (nowMins < spilloverMins) return true;
    }
  }
  return false;
}

/** Same shape as `isOpenAt` but returns the next opening as `HH:mm`
 *  on the same day, or `null` if the place won't open again today.
 *  Used by the public surface to render "Opens at 17:00" copy. */
export function nextOpeningToday(
  hours: WeeklyHours,
  now: Date,
): string | null {
  if (hours.length === 0) return null;
  const day = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todays = hours
    .filter((h) => h.day === day)
    .filter((h) => minutes(h.open) > nowMins)
    .sort((a, b) => minutes(a.open) - minutes(b.open));
  return todays[0]?.open ?? null;
}

/** Friendly "Mon-Fri 7:00-22:00 · Sat 9:00-15:00" string, derived
 *  from `WeeklyHours`. Used both as the campus-list card subtitle
 *  and the bilingual fallback when `hoursText` isn't set. */
export function formatWeeklyHours(
  hours: WeeklyHours,
  locale: "en" | "el" = "en",
): string {
  if (hours.length === 0) return "";
  const names = locale === "el" ? WEEKDAY_NAMES_EL : WEEKDAY_NAMES_EN;
  const byDay = new Map<Weekday, string[]>();
  for (const h of hours) {
    const list = byDay.get(h.day) ?? [];
    list.push(`${h.open}-${h.close}`);
    byDay.set(h.day, list);
  }
  // Group consecutive days that share the exact same range list.
  const days = Array.from({ length: 7 }, (_, i) => i as Weekday).filter(
    (d) => byDay.has(d),
  );
  const segments: string[] = [];
  let i = 0;
  while (i < days.length) {
    const start = days[i];
    const ranges = byDay.get(start)!.join(",");
    let end = start;
    while (
      i + 1 < days.length &&
      days[i + 1] === end + 1 &&
      byDay.get(days[i + 1])!.join(",") === ranges
    ) {
      end = days[i + 1];
      i++;
    }
    const label =
      start === end ? names[start] : `${names[start]}-${names[end]}`;
    segments.push(`${label} ${byDay.get(start)!.join(", ")}`);
    i++;
  }
  const sep = locale === "el" ? " · " : " · ";
  return segments.join(sep);
}

export interface OpenNowStatus {
  /** True when the location is currently open. */
  open: boolean;
  /** Short label suitable for a pill: "Open now" / "Closed" /
   *  "Opens at 17:00". Empty when there are no structured hours. */
  label: string;
  /** Localised body copy: same as `label` but in Greek when asked. */
  labelEl: string;
}

const STATUS_COPY = {
  open: { en: "Open now", el: "Ανοιχτά τώρα" },
  closed: { en: "Closed", el: "Κλειστά" },
  opensAt: { en: "Opens", el: "Ανοίγει" },
} as const;

/** One-shot status summary — used by every surface that needs to
 *  show "is it open?" plus follow-up copy. */
export function openNowStatus(
  value: unknown,
  now: Date,
): OpenNowStatus {
  const hours = parseHours(value);
  if (hours.length === 0) {
    return { open: false, label: "", labelEl: "" };
  }
  if (isOpenAt(hours, now)) {
    return {
      open: true,
      label: STATUS_COPY.open.en,
      labelEl: STATUS_COPY.open.el,
    };
  }
  const next = nextOpeningToday(hours, now);
  if (next) {
    return {
      open: false,
      label: `${STATUS_COPY.opensAt.en} ${next}`,
      labelEl: `${STATUS_COPY.opensAt.el} ${next}`,
    };
  }
  return {
    open: false,
    label: STATUS_COPY.closed.en,
    labelEl: STATUS_COPY.closed.el,
  };
}
