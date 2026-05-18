import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Products",
    links: [
      { name: "Klorad Campus", href: "/campus" },
      { name: "Klorad Mobility", href: "/mobility" },
      { name: "Klorad Virtual Heritage", href: "/virtual-heritage" },
      { name: "Klorad Urban", href: "/urban" },
    ],
  },
  {
    title: "Platform",
    links: [
      { name: "Overview", href: "/platform" },
      { name: "Worlds", href: "/samples" },
      { name: "Research", href: "/research" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "Partners", href: "/partners" },
      { name: "Journal", href: "/journal" },
      { name: "Contact", href: "/contact" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft bg-surface-2">
      <div className="mx-auto max-w-container px-6 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/klorad-icon-only-new.svg"
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px]"
              />
              <span className="text-sm font-semibold uppercase tracking-[0.32em] text-text-primary">
                Klorad
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
              A geospatial platform for digital twins — the foundation
              beneath the virtual worlds of tomorrow.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((column) => (
            <div key={column.title} className="space-y-4">
              <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-text-tertiary">
                {column.title}
              </h3>
              <nav className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col gap-3 border-t border-line-soft pt-8 text-sm text-text-tertiary md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} Klorad — developed by Prieston
            Technologies.
          </span>
          <span>Athens · Thessaloniki · Remote</span>
        </div>
      </div>
    </footer>
  );
}
