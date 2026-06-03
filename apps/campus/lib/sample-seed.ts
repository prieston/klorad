/**
 * Sample-campus seed — DB shape (Arc 7 of [[campus-consumer-pivot]]).
 *
 * Companion to `lib/sample-campus.ts` (the *consumer-shape* sample
 * used for the empty-state fallback on the public home). This file
 * holds the equivalent records shaped to the Prisma models we built
 * in Arcs 2-5 + Arc 8 bilingual columns, so
 * `POST /api/maps/[mapId]/seed-sample` can write a believable starter
 * set into a fresh campus in one click.
 *
 * Sized to look "lived in" rather than minimal — a rector demoing
 * the platform should see realistic counts (6 news / 8 events /
 * 6 clubs / 5 dining), variety of categories, and a sprinkling of
 * Greek translations so the bilingual story is visible.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockById } from "@/lib/stock-images";
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
  titleEl?: string;
  body: string;
  bodyEl?: string;
  category: NewsCategory;
  /** Days ago — turned into a real Date relative to now() at write time. */
  publishedDaysAgo: number;
  /** Stock image id from `lib/stock-images.ts`. Optional — when set,
   *  the seeded row lands with the matching public/stock SVG. */
  stockImage?: string;
  anchors: SeedAnchor[];
}

interface SeedEvent {
  title: string;
  titleEl?: string;
  description: string;
  descriptionEl?: string;
  /** Days from now (positive = future). */
  startsInDays: number;
  /** Duration of the event in hours. */
  durationHours: number;
  bannerColor: EventBanner;
  bannerIcon: EventIcon;
  expectedAttendance: number;
  organizer?: string;
  registrationUrl?: string;
  stockImage?: string;
  anchors: SeedAnchor[];
}

interface SeedClub {
  name: string;
  nameEl?: string;
  description: string;
  descriptionEl?: string;
  initials: string;
  avatarColor: ClubColor;
  memberCount: number;
  meetsCadence: string;
  externalLink: string;
  popularityScore: number;
  stockImage?: string;
}

interface SeedDining {
  name: string;
  nameEl?: string;
  description: string;
  descriptionEl?: string;
  /** Free-text caveat shown alongside the structured hours. */
  hoursText: string;
  /** Structured hours — drives the "Open now" badge on the public
   *  surface. See `lib/dining-hours.ts` for the shape. */
  hours: Array<{ day: number; open: string; close: string }>;
  cuisine: string;
  menuUrl?: string;
  stockImage?: string;
  anchors: SeedAnchor[];
}

/** Helper for the seed — give it a `[start, end]` range of weekdays
 *  (e.g. `[1, 5]` for Mon-Fri) plus an open/close pair, get an array
 *  of one shift per day in that range. */
function shiftRange(
  start: number,
  end: number,
  open: string,
  close: string,
): Array<{ day: number; open: string; close: string }> {
  const out: Array<{ day: number; open: string; close: string }> = [];
  for (let d = start; d <= end; d++) {
    out.push({ day: d, open, close });
  }
  return out;
}

const NEWS: SeedNews[] = [
  {
    title: "Library hours extended through finals",
    titleEl: "Παρατεταμένες ώρες βιβλιοθήκης για τις εξετάσεις",
    body: "Engineering South stays open 24 / 7 until June 9. Quiet floors are on 2 and 3; free coffee on the second floor every night from 8 pm. Bring your student ID after 11 pm.",
    bodyEl:
      "Το Engineering South παραμένει ανοιχτό 24/7 έως τις 9 Ιουνίου. Ησυχία στους ορόφους 2 και 3· δωρεάν καφές στον δεύτερο όροφο κάθε βράδυ από τις 8 μ.μ. Φέρτε τη φοιτητική σας ταυτότητα μετά τις 11 μ.μ.",
    category: "announcement",
    publishedDaysAgo: 3,
    stockImage: "news-campus",
    anchors: [
      { kind: "building", refId: "", refName: "Engineering South Building" },
    ],
  },
  {
    title: "Cafe Pavilion closed for renovation",
    body: "Closed May 28 — June 2 for a kitchen refit. Grab-and-go meals available at the Marketplace in the meantime. The patio remains open for seating.",
    category: "alert",
    publishedDaysAgo: 1,
    stockImage: "news-megaphone",
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    title: "New 3D printers in the Graphic Arts lab",
    titleEl: "Νέοι 3D εκτυπωτές στο εργαστήριο γραφικών τεχνών",
    body: "Six new printers landed last week — drop-in hours every weekday afternoon. Training session Tuesday at 4 pm; no sign-up needed.",
    bodyEl:
      "Έξι νέοι εκτυπωτές έφτασαν την περασμένη εβδομάδα — ελεύθερη πρόσβαση κάθε καθημερινό απόγευμα. Εκπαίδευση την Τρίτη στις 4 μ.μ.· δεν χρειάζεται εγγραφή.",
    category: "news",
    publishedDaysAgo: 7,
    stockImage: "news-bulletin",
    anchors: [
      { kind: "building", refId: "", refName: "Graphic Arts Building" },
    ],
  },
  {
    title: "Fire drill — Wednesday 10:30 am",
    body: "All-campus fire drill at 10:30 am Wednesday. Plan ~10 minutes outside. Faculty: please assist with attendance at your assembly point.",
    category: "alert",
    publishedDaysAgo: 0,
    stockImage: "news-megaphone",
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
      { kind: "building", refId: "", refName: "Engineering South Building" },
    ],
  },
  {
    title: "Campus shuttle adds Saturday evening service",
    body: "The 14R now runs Saturdays until midnight, looping the dorms, the Marketplace, and the Athletics Center. New timetable on the transportation page.",
    category: "news",
    publishedDaysAgo: 12,
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
  },
  {
    title: "Free counselling drop-ins this month",
    body: "Student wellness is hosting free 15-minute drop-ins every Tuesday and Thursday afternoon. No appointment, no notes taken. Just drop by.",
    category: "announcement",
    publishedDaysAgo: 5,
    anchors: [],
  },
];

const EVENTS: SeedEvent[] = [
  {
    title: "Open mic at the quad cafe",
    titleEl: "Βραδιά ελεύθερου μικροφώνου στο καφέ της πλατείας",
    description:
      "Bring a poem, a song, a stand-up bit. Sign-up at the door, sets are five minutes. Free entry, drinks at bar prices.",
    descriptionEl:
      "Φέρτε ένα ποίημα, ένα τραγούδι, ένα stand-up. Εγγραφή στην είσοδο, τα σετ είναι πέντε λεπτά. Δωρεάν είσοδος.",
    startsInDays: 2,
    durationHours: 3,
    bannerColor: "purple",
    bannerIcon: "music",
    expectedAttendance: 84,
    organizer: "Student union",
    stockImage: "events-stage",
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
    organizer: "Intramural sports",
    stockImage: "events-sports",
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
    organizer: "Sustainability union",
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
  },
  {
    title: "AI ethics panel: who's accountable?",
    description:
      "Faculty + invited speakers from industry. Q&A from the floor. Recorded; talk to the speakers in person after.",
    startsInDays: 6,
    durationHours: 2,
    bannerColor: "purple",
    bannerIcon: "calendar",
    expectedAttendance: 140,
    organizer: "Engineering school",
    registrationUrl: "https://example.com/ai-ethics",
    anchors: [
      { kind: "building", refId: "", refName: "Engineering South Building" },
    ],
  },
  {
    title: "Welcome barbecue for transfer students",
    description:
      "Veggie + meat options, sodas, music. Open to all transfer students and one guest each.",
    startsInDays: 10,
    durationHours: 3,
    bannerColor: "coral",
    bannerIcon: "sprout",
    expectedAttendance: 180,
    organizer: "Student affairs",
    stockImage: "events-confetti",
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
  },
  {
    title: "Film club: 'In the Mood for Love'",
    titleEl: "Σινέ λέσχη: «In the Mood for Love»",
    description:
      "Wong Kar-wai, 2000. Discussion after. Free popcorn while it lasts.",
    startsInDays: 8,
    durationHours: 3,
    bannerColor: "pink",
    bannerIcon: "music",
    expectedAttendance: 92,
    organizer: "Film club",
    anchors: [
      { kind: "building", refId: "", refName: "Graphic Arts Building" },
    ],
  },
  {
    title: "Trivia night with the data science society",
    description:
      "Teams of 4. $5 entry per team, winner takes the pot. Prizes for nerdiest team name.",
    startsInDays: 13,
    durationHours: 2,
    bannerColor: "teal",
    bannerIcon: "trophy",
    expectedAttendance: 64,
    organizer: "Data science society",
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    title: "Spring commencement",
    description:
      "Cap-and-gown collection from the bookstore by May 30. Live-stream from the main lawn for guests who can't attend.",
    startsInDays: 25,
    durationHours: 4,
    bannerColor: "purple",
    bannerIcon: "calendar",
    expectedAttendance: 2400,
    organizer: "Office of the registrar",
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
    ],
  },
];

const CLUBS: SeedClub[] = [
  {
    name: "Data science society",
    nameEl: "Όμιλος επιστήμης δεδομένων",
    description:
      "Weekly study groups, guest speakers from industry, and an end-of-semester data viz hackathon. Open to every major.",
    descriptionEl:
      "Εβδομαδιαία study groups, ομιλητές από τη βιομηχανία και ένα hackathon οπτικοποίησης στο τέλος του εξαμήνου. Ανοιχτός σε όλα τα τμήματα.",
    initials: "DS",
    avatarColor: "purple",
    memberCount: 248,
    meetsCadence: "Meets Wednesdays at 6 pm",
    externalLink: "https://discord.gg/example",
    popularityScore: 90,
    stockImage: "clubs-circle",
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
    stockImage: "clubs-quad",
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
    stockImage: "clubs-hands",
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
    stockImage: "clubs-circle",
  },
  {
    name: "Chess club",
    nameEl: "Όμιλος σκακιού",
    description:
      "Casual + rated games every Thursday, plus monthly tournaments. Boards provided, all levels welcome.",
    initials: "CC",
    avatarColor: "purple",
    memberCount: 64,
    meetsCadence: "Meets Thursdays at 7 pm",
    externalLink: "https://discord.gg/example",
    popularityScore: 55,
  },
  {
    name: "Robotics club",
    description:
      "Builds for the regional VEX + FRC competitions. Tools, parts, and mentorship from the engineering faculty.",
    initials: "RB",
    avatarColor: "coral",
    memberCount: 112,
    meetsCadence: "Meets Tuesdays and Thursdays at 5 pm",
    externalLink: "https://discord.gg/example",
    popularityScore: 75,
  },
];

const DINING: SeedDining[] = [
  {
    name: "Cafe Pavilion",
    nameEl: "Καφέ Παβιγιόν",
    description:
      "Quick-service cafe with sandwiches, bowls, espresso, and a long patio. Bring a laptop, stay all afternoon.",
    descriptionEl:
      "Γρήγορη εξυπηρέτηση με σάντουιτς, μπολ, espresso και μεγάλη βεράντα. Φέρτε τον φορητό σας, μείνετε όλο το απόγευμα.",
    hoursText: "",
    hours: [
      ...shiftRange(1, 5, "07:00", "22:00"),
      { day: 6, open: "09:00", close: "15:00" },
    ],
    cuisine: "Sandwiches, salads, coffee",
    stockImage: "dining-salad",
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    name: "Marketplace",
    description:
      "All-day food court — pizza, ramen, burrito bar, and a salad bar. Multiple stations, one card swipe.",
    hoursText: "",
    hours: shiftRange(0, 6, "07:00", "21:00"),
    cuisine: "International, fast-casual",
    stockImage: "dining-pizza",
    anchors: [
      { kind: "building", refId: "", refName: "1901 Marketplace Building" },
    ],
  },
  {
    name: "Mott juice bar",
    description:
      "Smoothies, açai bowls, cold-pressed juices. Inside the athletics centre, drop in after a workout.",
    hoursText: "",
    hours: [
      ...shiftRange(1, 5, "06:00", "20:00"),
      { day: 6, open: "08:00", close: "16:00" },
      { day: 0, open: "08:00", close: "16:00" },
    ],
    cuisine: "Smoothies, bowls",
    stockImage: "dining-salad",
    anchors: [
      { kind: "building", refId: "", refName: "Mott Athletics Center" },
    ],
  },
  {
    name: "Quad pizza",
    description:
      "Sourdough pizza by the slice, salads, and dessert. Late-night window opens at 9 pm.",
    // 25:00 = 01:00 the next day — see lib/dining-hours.ts for the
    // past-midnight encoding.
    hoursText: "Late-night window opens at 9 pm",
    hours: shiftRange(0, 6, "11:00", "25:00"),
    cuisine: "Pizza, salads",
    stockImage: "dining-pizza",
    anchors: [{ kind: "building", refId: "", refName: "Cafe Pavilion" }],
  },
  {
    name: "Library cafe",
    nameEl: "Καφέ βιβλιοθήκης",
    description:
      "Quiet espresso bar tucked inside Engineering South. Strict no-microwave policy; pastries from the campus bakery.",
    descriptionEl:
      "Ήσυχο espresso bar μέσα στο Engineering South. Αυστηρή απαγόρευση φούρνου μικροκυμάτων· γλυκά από τον φούρνο της πανεπιστημιούπολης.",
    hoursText: "",
    hours: [
      ...shiftRange(1, 5, "08:00", "23:00"),
      { day: 6, open: "10:00", close: "20:00" },
      { day: 0, open: "10:00", close: "20:00" },
    ],
    cuisine: "Coffee, pastries",
    stockImage: "dining-coffee",
    anchors: [
      { kind: "building", refId: "", refName: "Engineering South Building" },
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
    titleEl: n.titleEl ?? null,
    body: n.body,
    bodyEl: n.bodyEl ?? null,
    category: n.category,
    publishedAt: new Date(now - n.publishedDaysAgo * day),
    imageUrl: stockById(n.stockImage ?? "")?.url ?? null,
    anchors: n.anchors as unknown as Prisma.InputJsonValue,
  }));

  const eventRows = EVENTS.map((e) => {
    const startsAt = new Date(now + e.startsInDays * day);
    return {
      organizationId,
      projectId,
      title: e.title,
      titleEl: e.titleEl ?? null,
      description: e.description,
      descriptionEl: e.descriptionEl ?? null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + e.durationHours * hour),
      bannerColor: e.bannerColor,
      bannerIcon: e.bannerIcon,
      expectedAttendance: e.expectedAttendance,
      organizer: e.organizer ?? null,
      registrationUrl: e.registrationUrl ?? null,
      imageUrl: stockById(e.stockImage ?? "")?.url ?? null,
      anchors: e.anchors as unknown as Prisma.InputJsonValue,
    };
  });

  const clubRows = CLUBS.map((c) => ({
    organizationId,
    projectId,
    name: c.name,
    nameEl: c.nameEl ?? null,
    description: c.description,
    descriptionEl: c.descriptionEl ?? null,
    initials: c.initials,
    avatarColor: c.avatarColor,
    memberCount: c.memberCount,
    meetsCadence: c.meetsCadence,
    externalLink: c.externalLink,
    popularityScore: c.popularityScore,
    imageUrl: stockById(c.stockImage ?? "")?.url ?? null,
    anchors: [] as unknown as Prisma.InputJsonValue,
  }));

  const diningRows = DINING.map((d) => ({
    organizationId,
    projectId,
    name: d.name,
    nameEl: d.nameEl ?? null,
    description: d.description,
    descriptionEl: d.descriptionEl ?? null,
    hoursText: d.hoursText || null,
    hours: d.hours as unknown as Prisma.InputJsonValue,
    cuisine: d.cuisine,
    menuUrl: d.menuUrl ?? null,
    imageUrl: stockById(d.stockImage ?? "")?.url ?? null,
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

/**
 * Has this project been seeded already? "Anything in any rail" wins.
 *
 * Each `.count()` is guarded with `.catch(() => 0)` so a pending
 * migration (table missing) treats the project as "nothing seeded
 * yet" instead of crashing the onboarding page. The real fix when
 * this hits is still `pnpm prisma migrate deploy`; this is just the
 * safety net so the dashboard stays usable in the meantime.
 */
export async function projectHasContent(projectId: string): Promise<boolean> {
  const safeCount = async (
    p: () => Promise<number>,
    label: string,
  ): Promise<number> => {
    try {
      return await p();
    } catch (err) {
      console.error(`[projectHasContent] ${label} count failed`, err);
      return 0;
    }
  };
  const [n, e, c, d] = await Promise.all([
    safeCount(
      () => prisma.newsPost.count({ where: { projectId } }),
      "news",
    ),
    safeCount(
      () => prisma.eventPost.count({ where: { projectId } }),
      "events",
    ),
    safeCount(
      () => prisma.club.count({ where: { projectId } }),
      "clubs",
    ),
    safeCount(
      () => prisma.diningLocation.count({ where: { projectId } }),
      "dining",
    ),
  ]);
  return n + e + c + d > 0;
}
