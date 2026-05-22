import { redirect } from "next/navigation";

type Params = Promise<{ token: string }>;
type Search = Promise<{ space?: string | string[] }>;

/**
 * `/campus/[token]/indoor` — folded into `/campus/[token]/map`.
 *
 * The campus map is now MappedIn, so there's a single map route. This
 * redirect keeps any older `/indoor` links (and `?space=` deep links)
 * working.
 */
export default async function CampusIndoorRedirectPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const query =
    typeof sp.space === "string"
      ? `?space=${encodeURIComponent(sp.space)}`
      : "";
  redirect(`/campus/${token}/map${query}`);
}
