"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@klorad/design-system";

const products = [
  {
    name: "Klorad Campus",
    desc: "Campus mapping & wayfinding",
    href: "/campus",
  },
  {
    name: "Klorad Mobility",
    desc: "Roads, ITS & corridors",
    href: "/mobility",
  },
  {
    name: "Klorad Virtual Heritage",
    desc: "Heritage, reconstructed",
    href: "/virtual-heritage",
  },
  {
    name: "Klorad Urban",
    desc: "Cities & land as a living model",
    href: "/urban",
  },
] as const;

const links = [
  { name: "Platform", href: "/platform" },
  { name: "Worlds", href: "/samples" },
  { name: "Research", href: "/research" },
  { name: "Journal", href: "/journal" },
] as const;

function navClass(active: boolean) {
  return `text-sm transition-colors ${
    active
      ? "text-text-primary"
      : "text-text-secondary hover:text-text-primary"
  }`;
}

const mobileLinkClass =
  "rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-accent-soft hover:text-text-primary";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        productsRef.current &&
        !productsRef.current.contains(event.target as Node)
      ) {
        setProductsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setProductsOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));
  const productsActive = products.some((p) => isActive(p.href));

  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-glass backdrop-blur-xl">
      <div className="mx-auto flex max-w-container items-center justify-between px-6 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/klorad-icon-only-new.svg"
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px]"
            priority
          />
          <span className="text-sm font-semibold uppercase tracking-[0.32em] text-text-primary">
            Klorad
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-7 lg:flex">
          <Link href="/platform" className={navClass(isActive("/platform"))}>
            Platform
          </Link>

          <div ref={productsRef} className="relative">
            <button
              type="button"
              onClick={() => setProductsOpen((open) => !open)}
              aria-expanded={productsOpen}
              className={`flex items-center gap-1.5 ${navClass(productsActive)}`}
            >
              Products
              <Chevron open={productsOpen} />
            </button>
            {productsOpen && (
              <div className="absolute left-1/2 top-full w-[320px] -translate-x-1/2 pt-3">
                <div className="glass-panel rounded-xl p-2 shadow-glass">
                  {products.map((product) => (
                    <Link
                      key={product.href}
                      href={product.href}
                      className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-accent-soft"
                    >
                      <span className="block text-sm font-medium text-text-primary">
                        {product.name}
                      </span>
                      <span className="block text-xs text-text-tertiary">
                        {product.desc}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/samples" className={navClass(isActive("/samples"))}>
            Worlds
          </Link>
          <Link href="/research" className={navClass(isActive("/research"))}>
            Research
          </Link>
          <Link href="/journal" className={navClass(isActive("/journal"))}>
            Journal
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/contact"
            className="hidden rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover sm:inline-flex"
          >
            Schedule a demo
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line-soft text-text-secondary lg:hidden"
          >
            {mobileOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <nav className="border-t border-line-soft bg-glass backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-container flex-col gap-1 px-6 py-4">
            <Link href="/platform" className={mobileLinkClass}>
              Platform
            </Link>
            <div className="py-2">
              <span className="px-3 text-[11px] uppercase tracking-[0.22em] text-text-tertiary">
                Products
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {products.map((product) => (
                  <Link
                    key={product.href}
                    href={product.href}
                    className={mobileLinkClass}
                  >
                    {product.name}
                  </Link>
                ))}
              </div>
            </div>
            {links
              .filter((link) => link.href !== "/platform")
              .map((link) => (
                <Link key={link.href} href={link.href} className={mobileLinkClass}>
                  {link.name}
                </Link>
              ))}
            <Link
              href="/contact"
              className="mt-3 rounded-md bg-accent px-4 py-3 text-center text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              Schedule a demo
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
