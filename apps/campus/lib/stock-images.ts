/**
 * Curated stock image library for the campus content admins. Twelve
 * bundled SVGs covering news, events, clubs and dining. Used as the
 * default "Stock" tab in `ImagePicker` and threaded through the
 * sample seed so a fresh campus opens onto something that already
 * looks designed.
 *
 * Why SVG, not real photos:
 *   - zero external dependency (no Unsplash quota, no API key, no
 *     CDN that can go down on demo day)
 *   - 1-2 KB each — about 0.1% of a real JPG
 *   - License-clean — drawn in-house, no attribution dance
 *   - Stay sharp at any card size since the campus cards use the
 *     same banner image at very different aspect ratios
 *
 * Keep the array short — a stock library that feels curated lands
 * better with rectors than one that requires scrolling.
 */
export interface StockImage {
  id: string;
  /** Public URL — served from `public/stock/*.svg`. */
  url: string;
  /** Which content kind it fits best. The picker filters by this
   *  so the dining admin opens to dining images, etc. */
  category: "news" | "events" | "clubs" | "dining";
  /** Short label shown under the thumbnail. */
  label: string;
}

export const STOCK_IMAGES: StockImage[] = [
  // News
  { id: "news-bulletin", url: "/stock/news-bulletin.svg", category: "news", label: "Bulletin board" },
  { id: "news-megaphone", url: "/stock/news-megaphone.svg", category: "news", label: "Announcement" },
  { id: "news-campus", url: "/stock/news-campus.svg", category: "news", label: "Campus at dusk" },
  // Events
  { id: "events-stage", url: "/stock/events-stage.svg", category: "events", label: "Live stage" },
  { id: "events-confetti", url: "/stock/events-confetti.svg", category: "events", label: "Celebration" },
  { id: "events-sports", url: "/stock/events-sports.svg", category: "events", label: "Athletics" },
  // Clubs
  { id: "clubs-circle", url: "/stock/clubs-circle.svg", category: "clubs", label: "Group circle" },
  { id: "clubs-hands", url: "/stock/clubs-hands.svg", category: "clubs", label: "Hands joined" },
  { id: "clubs-quad", url: "/stock/clubs-quad.svg", category: "clubs", label: "On the quad" },
  // Dining
  { id: "dining-coffee", url: "/stock/dining-coffee.svg", category: "dining", label: "Coffee" },
  { id: "dining-pizza", url: "/stock/dining-pizza.svg", category: "dining", label: "Pizza" },
  { id: "dining-salad", url: "/stock/dining-salad.svg", category: "dining", label: "Salad" },
];

/** Subset by category — the picker uses this to default to "your
 *  category" when the modal opens. */
export function stockByCategory(
  category: StockImage["category"],
): StockImage[] {
  return STOCK_IMAGES.filter((img) => img.category === category);
}

/** Look up a stock image by URL. Used by the seed to thread URLs
 *  via id without hardcoding paths twice. */
export function stockById(id: string): StockImage | undefined {
  return STOCK_IMAGES.find((img) => img.id === id);
}
