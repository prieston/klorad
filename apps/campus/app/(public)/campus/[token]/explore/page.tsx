import { redirect } from "next/navigation";

type Params = Promise<{ token: string }>;
type Search = Promise<{ tab?: string | string[]; lang?: string | string[] }>;

/**
 * `/campus/[token]/explore` — the Explore tab in the mobile bottom
 * nav. Resolves to the matching content surface:
 *   - `?tab=news|events|clubs|dining` → `/campus/[token]/<tab>`
 *   - no `?tab=` → `/campus/[token]/events` (default landing)
 *
 * Pure redirect — each content tab keeps its canonical URL so deep
 * links from notifications, emails, and embeds stay stable. The
 * segmented control on each list page surfaces the other three
 * tabs visually.
 */
export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = typeof sp.lang === "string" ? `?lang=${sp.lang}` : "";
  const tab = typeof sp.tab === "string" ? sp.tab.toLowerCase() : "";
  const allowed = ["news", "events", "clubs", "dining"] as const;
  const target = (allowed as readonly string[]).includes(tab) ? tab : "events";
  redirect(`/campus/${token}/${target}${lang}`);
}
