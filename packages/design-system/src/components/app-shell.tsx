"use client";

import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "../utils/cn";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
  /** Optional small badge / count rendered at the right edge of the row. */
  badge?: ReactNode;
};

export type NavGroup = {
  /** Small-caps section header rendered above the items. Omit for an unlabeled group. */
  label?: string;
  items: NavItem[];
};

/** A link renderer — pass `next/link`'s `Link` so nav uses client routing. */
type LinkComponent = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
}>;

const DefaultLink: LinkComponent = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

export type AppShellProps = {
  /** Brand block at the top of the sidebar (logo + name). */
  brand: ReactNode;
  /** Optional node between the brand and the nav — e.g. an org/workspace switcher. */
  sidebarHeader?: ReactNode;
  /**
   * Primary navigation as a flat list. Pass either `nav` *or* `navGroups`;
   * if both are provided, `navGroups` wins.
   */
  nav?: NavItem[];
  /**
   * Primary navigation as labelled groups — for IAs that need section
   * headers (e.g. "PUBLIC SURFACES", "MANAGE"). When provided, replaces
   * the flat `nav` rendering.
   */
  navGroups?: NavGroup[];
  /** Optional node pinned to the bottom of the sidebar (user menu, org switcher). */
  sidebarFooter?: ReactNode;
  /** Optional top-bar title or breadcrumb (left side). */
  title?: ReactNode;
  /** Optional top-bar actions (right side) — theme toggle, etc. */
  actions?: ReactNode;
  /** Link component for nav items (e.g. `next/link`). Defaults to `<a>`. */
  linkComponent?: LinkComponent;
  children: ReactNode;
};

/**
 * The management shell: a fixed sidebar, a top bar, and a scrolling content
 * area. Used for account / dashboard surfaces. On small screens the sidebar
 * collapses into a drawer.
 */
export function AppShell({
  brand,
  sidebarHeader,
  nav,
  navGroups,
  sidebarFooter,
  title,
  actions,
  linkComponent: Link = DefaultLink,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // `navGroups` wins when both are passed — callers migrating from flat
  // nav to grouped nav can do so without juggling both props.
  const groups: NavGroup[] =
    navGroups ?? (nav ? [{ items: nav }] : []);

  const renderItem = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        item.active
          ? "bg-accent-soft text-text-primary"
          : "text-text-secondary hover:bg-accent-soft hover:text-text-primary",
      )}
    >
      {item.icon ? (
        <span className="flex h-5 w-5 items-center justify-center">
          {item.icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge !== null ? (
        <span className="shrink-0 text-[11px] font-medium text-text-tertiary">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
      {sidebarHeader ? (
        <div className="shrink-0 px-3 pb-2">{sidebarHeader}</div>
      ) : null}
      <nav
        className="flex-1 overflow-y-auto px-3 py-2"
        onClick={() => setMobileOpen(false)}
      >
        {groups.map((group, idx) => (
          <div
            key={group.label ?? `group-${idx}`}
            className={idx === 0 ? "space-y-1" : "mt-5 space-y-1"}
          >
            {group.label ? (
              <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                {group.label}
              </div>
            ) : null}
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>
      {sidebarFooter ? (
        <div className="shrink-0 border-t border-line-soft p-3">
          {sidebarFooter}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-screen bg-bg text-text-primary">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-line-soft bg-surface-1 lg:block">
        {sidebar}
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-line-soft bg-surface-1">
            {sidebar}
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft bg-surface-1 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line-soft text-text-secondary lg:hidden"
          >
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
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
            {title}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
