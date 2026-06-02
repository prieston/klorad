"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Compass,
  MapPin,
  Newspaper,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { AssistantAction } from "@/lib/assistant/tools";
import type { Locale } from "@/app/lib/i18n-core";

interface Props {
  actions: AssistantAction[];
  /** Project id — also the public route segment (`/campus/[token]`). */
  mapId: string;
  /** Locale appended as `?lang=` so language survives the deep link. */
  locale: Locale;
}

interface Card {
  Icon: LucideIcon;
  label: string;
  sublabel: string;
  href: string;
}

/**
 * Compact "Open …" affordance label used on every source card. Pulls
 * EL when the visitor is in Greek so the cards read in their language.
 */
const VERB: Record<Locale, Record<AssistantAction["action"], string>> = {
  en: {
    focus: "Show on map",
    route: "Get directions",
    open_news: "Open news",
    open_event: "Open event",
    open_club: "Open club",
    open_dining: "View dining",
  },
  el: {
    focus: "Δες στον χάρτη",
    route: "Πάρε διαδρομή",
    open_news: "Άνοιγμα είδησης",
    open_event: "Άνοιγμα εκδήλωσης",
    open_club: "Άνοιγμα συλλόγου",
    open_dining: "Άνοιγμα φαγητού",
  },
};

const STEP_FREE_LABEL: Record<Locale, string> = {
  en: "step-free",
  el: "προσβάσιμη",
};

/**
 * Translate an `AssistantAction` into a renderable Card. Centralised
 * here so adding a new action variant is one switch arm — every other
 * piece of UI inherits the new card shape for free.
 *
 * URL conventions:
 *
 *   - News / events / clubs each have a detail page at
 *     `/campus/[token]/<surface>/[id]`.
 *   - Dining has no detail page yet, so cards land on the list with a
 *     `#<id>` anchor — the page can scroll into view in a follow-up.
 *   - `focus` deep-links to the map with `?b=<id>`, the URL-state
 *     convention the map already consumes for building selection
 *     (shipped in PR #169 area).
 *   - `route` uses the existing `?route=1&from&to&a` state from the
 *     map-page URL contract.
 */
function actionToCard(
  action: AssistantAction,
  mapId: string,
  locale: Locale,
): Card | null {
  const lang = `lang=${locale}`;
  const base = `/campus/${mapId}`;
  const verb = VERB[locale][action.action];
  switch (action.action) {
    case "open_news":
      return {
        Icon: Newspaper,
        label: action.title,
        sublabel: verb,
        href: `${base}/news/${encodeURIComponent(action.id)}?${lang}`,
      };
    case "open_event":
      return {
        Icon: Calendar,
        label: action.title,
        sublabel: verb,
        href: `${base}/events/${encodeURIComponent(action.id)}?${lang}`,
      };
    case "open_club":
      return {
        Icon: Users,
        label: action.name,
        sublabel: verb,
        href: `${base}/clubs/${encodeURIComponent(action.id)}?${lang}`,
      };
    case "open_dining":
      return {
        Icon: Utensils,
        label: action.name,
        sublabel: verb,
        href: `${base}/dining?${lang}#${encodeURIComponent(action.id)}`,
      };
    case "focus":
      return {
        Icon: MapPin,
        label: action.toName ?? "Space",
        sublabel: verb,
        href: `${base}/map?b=${encodeURIComponent(action.toId)}&${lang}`,
      };
    case "route": {
      const acc = action.accessible ? `· ${STEP_FREE_LABEL[locale]}` : "";
      const label =
        action.fromName && action.toName
          ? `${action.fromName} → ${action.toName}`
          : "Route";
      return {
        Icon: Compass,
        label,
        sublabel: `${verb} ${acc}`.trim(),
        href: `${base}/map?route=1&from=${encodeURIComponent(action.fromId)}&to=${encodeURIComponent(action.toId)}${
          action.accessible ? "&a=1" : ""
        }&${lang}`,
      };
    }
    default:
      return null;
  }
}

/**
 * Stack of source cards under an assistant message. Each card is a
 * tappable deep-link into the rest of the app — the answer Klio gives
 * + the place to open it without having to click around. Renders
 * nothing when there are no actions, so message bodies without
 * citations stay clean.
 */
export function KlioSourceCards({ actions, mapId, locale }: Props) {
  if (!actions || actions.length === 0) return null;
  const cards = actions
    .map((a) => actionToCard(a, mapId, locale))
    .filter((c): c is Card => c !== null);
  if (cards.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {cards.map((card, idx) => (
        <li key={`${card.href}-${idx}`}>
          <Link
            href={card.href}
            className="group flex items-center gap-3 rounded-xl border border-[var(--brand-line)] bg-white px-3 py-2 transition-colors hover:border-[var(--brand-primary)]"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-bg)] text-[var(--brand-primary)]"
            >
              <card.Icon size={15} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--brand-text)]">
                {card.label}
              </span>
              <span className="block truncate text-[11px] text-[var(--brand-text-muted)]">
                {card.sublabel}
              </span>
            </span>
            <ArrowUpRight
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-[var(--brand-text-muted)] transition-colors group-hover:text-[var(--brand-primary)]"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
