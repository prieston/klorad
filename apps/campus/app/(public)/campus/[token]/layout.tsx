import type { ReactNode } from "react";
import { CampusBottomNav } from "@/lib/consumer/CampusBottomNav";

type Params = Promise<{ token: string }>;

/**
 * Shared layout for every `/campus/[token]` route — mounts the
 * mobile bottom nav so the four primary tabs (Home / Map / Explore /
 * Klio) are always reachable, regardless of which page the visitor
 * landed on. Hidden on desktop where `ConsumerNav` carries the same
 * destinations.
 *
 * Pages render their own `ConsumerNav`/content inside `children` —
 * the layout only wraps. The map route opts out of the
 * bottom-padding by using its own `h-screen flex` layout; everything
 * else gets a `pb-24` so the floating nav doesn't cover the footer.
 */
export default async function CampusPublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { token } = await params;
  return (
    <>
      {children}
      <CampusBottomNav token={token} />
    </>
  );
}
