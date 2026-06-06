/**
 * Consumer-home data shapes.
 *
 * Kept deliberately close to the schemas we'll persist in Arcs 2-5,
 * so when the rails switch source from `sample-campus.ts` constants
 * to the API they don't have to change shape. Localisation is on
 * the per-arc roadmap — strings here are EN-only for now.
 */

export interface ConsumerAnchor {
  kind: "building" | "room";
  /** MappedIn space id. Empty in sample data; reconciled at deploy time. */
  refId: string;
  /** Denormalised display name — survives a MappedIn rename for one cycle. */
  refName: string;
}

export type AccentName = "purple" | "coral" | "teal" | "pink";

export interface ConsumerNews {
  id: string;
  title: string;
  /** One-paragraph summary shown in the rail. */
  excerpt: string;
  category: "announcement" | "news" | "alert";
  publishedAt: string;
  anchors: ConsumerAnchor[];
}

export interface ConsumerEvent {
  id: string;
  title: string;
  /** Short blurb shown under the title. */
  blurb: string;
  startsAt: string;
  endsAt: string;
  /** Banner accent — colour vocabulary, not branding. */
  bannerColor: AccentName;
  /** Lucide icon name used on the banner. */
  bannerIcon: "music" | "trophy" | "sprout" | "calendar";
  /** Optional hero image — rendered above the title when present;
   *  falls back to the striped banner + icon when null. */
  imageUrl?: string | null;
  anchors: ConsumerAnchor[];
  /** Vanity admin-set "expected attendance" — see [[campus-consumer-pivot]]. */
  expectedAttendance?: number;
}

export interface ConsumerClub {
  id: string;
  name: string;
  /** Two-letter avatar initials. */
  initials: string;
  avatarColor: AccentName;
  memberCount: number;
  /** Free-text frequency, e.g. "Meets Tuesdays at 6 pm". */
  meetsCadence: string;
  /** External link the View / Join button opens (Discord, Insta, …). */
  externalLink: string;
}

export interface ConsumerDining {
  id: string;
  name: string;
  /** Free-text hours / status — surfaced as the rail's subtitle. */
  status: string;
}
