/**
 * Sample-campus seed.
 *
 * Used by Arc 1 to populate the new consumer home before any CRUD
 * exists. Shaped exactly like the eventual schema (`ConsumerNews`,
 * `ConsumerEvent`, `ConsumerClub`), so subsequent arcs switch the
 * rail source from constants to the API with no markup change.
 *
 * Also reused as the "Try with sample data" onboarding seed and
 * the 60-second demo fixture. Keep it tight (4 news / 4 events /
 * 4 clubs) — a venue with more isn't more believable, just slower
 * to read.
 *
 * Anchors point at building names that exist in the MappedIn Cal
 * Poly Pomona demo we've been testing on; `refId` is filled at
 * deploy time, see [[campus-consumer-pivot]].
 */

import type {
  ConsumerClub,
  ConsumerEvent,
  ConsumerNews,
} from "./consumer/types";

export const SAMPLE_NEWS: ConsumerNews[] = [
  {
    id: "news-library-hours",
    title: "Library hours extended through finals",
    excerpt:
      "Engineering South stays open 24 / 7 until June 9. Quiet floors, free coffee on the second floor every night from 8 pm.",
    category: "announcement",
    publishedAt: "2026-05-23T09:00:00Z",
    anchors: [
      {
        kind: "building",
        refId: "",
        refName: "Engineering South Building",
      },
    ],
  },
  {
    id: "news-cafe-renovation",
    title: "Cafe Pavilion closed for renovation",
    excerpt:
      "Closed May 28 — June 2 for a kitchen refit. Grab-and-go meals available at the Marketplace in the meantime.",
    category: "alert",
    publishedAt: "2026-05-25T11:30:00Z",
    anchors: [
      { kind: "building", refId: "", refName: "Cafe Pavilion" },
    ],
  },
  {
    id: "news-3d-printers",
    title: "New 3D printers in the Graphic Arts lab",
    excerpt:
      "Six new printers landed last week — drop-in hours every weekday afternoon, training Tuesday at 4 pm.",
    category: "news",
    publishedAt: "2026-05-19T15:00:00Z",
    anchors: [
      { kind: "building", refId: "", refName: "Graphic Arts Building" },
    ],
  },
];

export const SAMPLE_EVENTS: ConsumerEvent[] = [
  {
    id: "evt-open-mic",
    title: "Open mic at the quad cafe",
    blurb:
      "Bring a poem, a song, a stand-up bit. Sign-up at the door, sets are five minutes.",
    startsAt: "2026-05-28T19:00:00Z",
    endsAt: "2026-05-28T22:00:00Z",
    bannerColor: "purple",
    bannerIcon: "music",
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
    expectedAttendance: 84,
  },
  {
    id: "evt-bball-finals",
    title: "Intramural basketball finals",
    blurb:
      "The Reds vs the Greens. Free entry with student ID. Doors at 5:30 pm, tip-off at 6.",
    startsAt: "2026-05-29T18:00:00Z",
    endsAt: "2026-05-29T21:00:00Z",
    bannerColor: "coral",
    bannerIcon: "trophy",
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
    ],
    expectedAttendance: 212,
  },
  {
    id: "evt-garden-volunteer",
    title: "Community garden volunteer day",
    blurb:
      "Planting summer tomatoes, weeding, and lunch. Tools provided; bring a hat.",
    startsAt: "2026-05-30T10:00:00Z",
    endsAt: "2026-05-30T14:00:00Z",
    bannerColor: "teal",
    bannerIcon: "sprout",
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
    expectedAttendance: 36,
  },
];

export const SAMPLE_CLUBS: ConsumerClub[] = [
  {
    id: "club-ds-society",
    name: "Data science society",
    initials: "DS",
    avatarColor: "purple",
    memberCount: 248,
    meetsCadence: "Meets Wednesdays at 6 pm",
    externalLink: "https://discord.gg/example",
  },
  {
    id: "club-film",
    name: "Film club",
    initials: "FC",
    avatarColor: "pink",
    memberCount: 142,
    meetsCadence: "Screenings every Friday at 8 pm",
    externalLink: "https://instagram.com/example",
  },
  {
    id: "club-hiking",
    name: "Hiking & outdoors",
    initials: "HK",
    avatarColor: "coral",
    memberCount: 186,
    meetsCadence: "Trips most Saturdays",
    externalLink: "https://discord.gg/example",
  },
  {
    id: "club-sustainability",
    name: "Sustainability union",
    initials: "SU",
    avatarColor: "teal",
    memberCount: 97,
    meetsCadence: "Meets Mondays at 5 pm",
    externalLink: "https://instagram.com/example",
  },
];
