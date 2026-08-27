import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  // An embed is a fragment of someone else's page. Keeping it out of search
  // results avoids competing with the canonical record for the same content.
  robots: { index: false, follow: false },
};

/**
 * Embed shell.
 *
 * Deliberately bare: no navigation, no venue chrome, nothing that assumes it
 * owns the viewport. §7.4.2 requires the viewer to work "in a cross-origin
 * iframe on a page Klorad does not control", which means it also has to *look*
 * like a component rather than a page that has been squeezed.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <div className="h-[100dvh] w-full overflow-hidden bg-bg">{children}</div>;
}
