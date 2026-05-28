/**
 * Sample-campus seed — DB shape (Arc 7 of [[campus-consumer-pivot]]).
 *
 * Companion to `lib/sample-campus.ts` (which is the *consumer-shape*
 * sample used for empty-state fallback on the public home). This
 * file holds the equivalent records shaped to the Prisma models we
 * built in Arcs 2-5, so `POST /api/maps/[mapId]/seed-sample` can
 * write a believable starter set into a fresh campus in one click.
 *
 * Kept deliberately small (4 news · 3 events · 4 clubs · 3 dining).
 * The point is to show that the rails render, not to fake a real
 * campus.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ClubColor,
  EventBanner,
  EventIcon,
  NewsCategory,
} from "@prisma/client";

interface SeedAnchor {
  kind: "building" | "room";
  refId: string;
  refName: string;
}

interface SeedNews {
  title: string;
  body: string;
  category: NewsCategory;
  /** Days ago — turned into a real Date relative to now() at write time. */
  publishedDaysAgo: number;
  anchors: SeedAnchor[];
}

interface SeedEvent {
  title: string;
  description: string;
  /** Days from now (positive = future). */
  startsInDays: number;
  /** Duration of the event in hours. */
  durationHours: number;
  bannerColor: EventBanner;
  bannerIcon: EventIcon;
  expectedAttendance: number;
  anchors: SeedAnchor[];
}

interface SeedClub {
  name: string;
  description: string;
  initials: string;
  avatarColor: ClubColor;
  memberCount: number;
  meetsCadence: string;
  externalLink: string;
  popularityScore: number;
}

interface SeedDining {
  name: string;
  description: string;
  hoursText: string;
  cuisine: string;
  menuUrl?: string;
  anchors: SeedAnchor[];
}

const NEWS: SeedNews[] = [
  {
    title: "Library hours extended through finals",
    body: "Engineering South stays open 24 / 7 until June 9. Quiet floors are on 2 and 3; free coffee on the second floor every night from 8 pm. Bring your student ID after 11 pm.",
    category: "announcement",
    publishedDaysAgo: 3,
    anchors: [
      { kind: "building", refId: "", refName: "Engineering South Building" },
    ],
  },
  {
    title: "Cafe Pavilion closed for renovation",
    body: "Closed May 28 — June 2 for a kitchen refit. Grab-and-go meals available at the Marketplace in the meantime. The patio remains open for seating.",
    category: "alert",
    publishedDaysAgo: 1,
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    title: "New 3D printers in the Graphic Arts lab",
    body: "Six new printers landed last week — drop-in hours every weekday afternoon. Training session Tuesday at 4 pm; no sign-up needed.",
    category: "news",
    publishedDaysAgo: 7,
    anchors: [
      { kind: "building", refId: "", refName: "Graphic Arts Building" },
    ],
  },
  {
    title: "Fire drill — Wednesday 10:30 am",
    body: "All-campus fire drill at 10:30 am Wednesday. Plan ~10 minutes outside. Faculty: please assist with attendance at your assembly point.",
    category: "alert",
    publishedDaysAgo: 0,
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
      { kind: "building", refId: "", refName: "Engineering South Building" },
    ],
  },
];

const EVENTS: SeedEvent[] = [
  {
    title: "Open mic at the quad cafe",
    description:
      "Bring a poem, a song, a stand-up bit. Sign-up at the door, sets are five minutes. Free entry, drinks at bar prices.",
    startsInDays: 2,
    durationHours: 3,
    bannerColor: "purple",
    bannerIcon: "music",
    expectedAttendance: 84,
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    title: "Intramural basketball finals",
    description:
      "The Reds vs the Greens. Free entry with student ID. Doors at 5:30 pm, tip-off at 6.",
    startsInDays: 3,
    durationHours: 3,
    bannerColor: "coral",
    bannerIcon: "trophy",
    expectedAttendance: 212,
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
    ],
  },
  {
    title: "Community garden volunteer day",
    description:
      "Planting summer tomatoes, weeding, and lunch. Tools provided; bring a hat and a refillable bottle.",
    startsInDays: 4,
    durationHours: 4,
    bannerColor: "teal",
    bannerIcon: "sprout",
    expectedAttendance: 36,
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
  },
];

const CLUBS: SeedClub[] = [
  {
    name: "Data science society",
    description:
      "Weekly study groups, guest speakers from industry, and an end-of-semester data viz hackathon. Open to every major.",
    initials: "DS",
    avatarColor: "purple",
    memberCount: 248,
    meetsCadence: "Meets Wednesdays at 6 pm",
    externalLink: "https://discord.gg/example",
    popularityScore: 90,
  },
  {
    name: "Film club",
    description:
      "Screenings every Friday — student picks, classics, and the occasional director Q&A. Free popcorn while it lasts.",
    initials: "FC",
    avatarColor: "pink",
    memberCount: 142,
    meetsCadence: "Screenings every Friday at 8 pm",
    externalLink: "https://instagram.com/example",
    popularityScore: 80,
  },
  {
    name: "Hiking & outdoors",
    description:
      "Day hikes most Saturdays, plus monthly overnight trips. Gear shares + carpools handled in the Discord.",
    initials: "HK",
    avatarColor: "coral",
    memberCount: 186,
    meetsCadence: "Trips most Saturdays",
    externalLink: "https://discord.gg/example",
    popularityScore: 85,
  },
  {
    name: "Sustainability union",
    description:
      "Campus zero-waste projects, the community garden, and policy advocacy. Anyone can join — show up to one meeting.",
    initials: "SU",
    avatarColor: "teal",
    memberCount: 97,
    meetsCadence: "Meets Mondays at 5 pm",
    externalLink: "https://instagram.com/example",
    popularityScore: 70,
  },
];

const DINING: SeedDining[] = [
  {
    name: "Cafe Pavilion",
    description:
      "Quick-service cafe with sandwiches, bowls, espresso, and a long patio. Bring a laptop, stay all afternoon.",
    hoursText: "Mon-Fri 7am-10pm · Sat 9am-3pm · Sun closed",
    cuisine: "Sandwiches, salads, coffee",
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    name: "Marketplace",
    description:
      "All-day food court — pizza, ramen, burrito bar, and a salad bar. Multiple stations, one card swipe.",
    hoursText: "Mon-Sun 7am-9pm",
    cuisine: "International, fast-casual",
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
  },
  {
    name: "Mott juice bar",
    description:
      "Smoothies, açai bowls, cold-pressed juices. Inside the athletics centre, drop in after a workout.",
    hoursText: "Mon-Fri 6am-8pm · Sat-Sun 8am-4pm",
    cuisine: "Smoothies, bowls",
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
    ],
  },
];

/**
 * Write the seed into a project. Idempotent — call it twice and you
 * get two copies of everything. Callers gate on "the project has no
 * existing content yet" if they want exactly-once semantics.
 */
export async function seedSampleCampus(
  projectId: string,
  organizationId: string,
): Promise<{
  news: number;
  events: number;
  clubs: number;
  dining: number;
}> {
  const now = Date.now();
  const day = 86_400_000;
  const hour = 3_600_000;

  const newsRows = NEWS.map((n) => ({
    organizationId,
    projectId,
    title: n.title,
    body: n.body,
    category: n.category,
    publishedAt: new Date(now - n.publishedDaysAgo * day),
    anchors: n.anchors as unknown as Prisma.InputJsonValue,
  }));

  const eventRows = EVENTS.map((e) => {
    const startsAt = new Date(now + e.startsInDays * day);
    return {
      organizationId,
      projectId,
      title: e.title,
      description: e.description,
      startsAt,
      endsAt: new Date(startsAt.getTime() + e.durationHours * hour),
      bannerColor: e.bannerColor,
      bannerIcon: e.bannerIcon,
      expectedAttendance: e.expectedAttendance,
      anchors: e.anchors as unknown as Prisma.InputJsonValue,
    };
  });

  const clubRows = CLUBS.map((c) => ({
    organizationId,
    projectId,
    name: c.name,
    description: c.description,
    initials: c.initials,
    avatarColor: c.avatarColor,
    memberCount: c.memberCount,
    meetsCadence: c.meetsCadence,
    externalLink: c.externalLink,
    popularityScore: c.popularityScore,
  }));

  const diningRows = DINING.map((d) => ({
    organizationId,
    projectId,
    name: d.name,
    description: d.description,
    hoursText: d.hoursText,
    cuisine: d.cuisine,
    menuUrl: d.menuUrl ?? null,
    anchors: d.anchors as unknown as Prisma.InputJsonValue,
  }));

  const [news, events, clubs, dining] = await Promise.all([
    prisma.newsPost.createMany({ data: newsRows }),
    prisma.eventPost.createMany({ data: eventRows }),
    prisma.club.createMany({ data: clubRows }),
    prisma.diningLocation.createMany({ data: diningRows }),
  ]);

  return {
    news: news.count,
    events: events.count,
    clubs: clubs.count,
    dining: dining.count,
  };
}

/** Has this project been seeded already? "Anything in any rail" wins. */
export async function projectHasContent(projectId: string): Promise<boolean> {
  const [n, e, c, d] = await Promise.all([
    prisma.newsPost.count({ where: { projectId } }),
    prisma.eventPost.count({ where: { projectId } }),
    prisma.club.count({ where: { projectId } }),
    prisma.diningLocation.count({ where: { projectId } }),
  ]);
  return n + e + c + d > 0;
}
