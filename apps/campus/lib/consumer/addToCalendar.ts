/**
 * Build a Google Calendar URL the user can tap to add an event to
 * their personal calendar. Google's web flow then offers to copy
 * across to Outlook / Apple via the standard ICS export, so a
 * single URL covers the most common calendar apps without us
 * shipping an ICS generator yet.
 */

interface AddToCalendarParams {
  title: string;
  /** ISO timestamp. */
  startsAt: string;
  /** ISO timestamp — falls back to start + 1h when missing / invalid. */
  endsAt?: string | null;
  /** Optional location string (e.g. "Student Union · Central Square"). */
  location?: string;
  /** Optional description / blurb. */
  details?: string;
}

/** Format an ISO timestamp as Google's `YYYYMMDDTHHmmssZ` pattern. */
function toGoogleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarHref(params: AddToCalendarParams): string {
  const start = toGoogleDate(params.startsAt);
  const endIso =
    params.endsAt && !Number.isNaN(Date.parse(params.endsAt))
      ? params.endsAt
      : new Date(
          new Date(params.startsAt).getTime() + 60 * 60 * 1000,
        ).toISOString();
  const end = toGoogleDate(endIso);
  const search = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${start}/${end}`,
  });
  if (params.location) search.set("location", params.location);
  if (params.details) search.set("details", params.details);
  return `https://www.google.com/calendar/render?${search.toString()}`;
}
