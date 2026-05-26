import Link from "next/link";

const FILTER_PILLS: { label: string; active?: boolean }[] = [
  { label: "Study spots", active: true },
  { label: "Food" },
  { label: "Fitness" },
  { label: "Events" },
];

interface BuildingDot {
  label: string;
  x: number;
  y: number;
  color: string;
}

/**
 * Six representative dots placed on a soft-teal canvas — the
 * teaser only suggests there is a map; the real one is one tap
 * away on `/map`.
 */
const BUILDINGS: BuildingDot[] = [
  { label: "Library", x: 70, y: 50, color: "var(--brand-primary)" },
  { label: "Sci hall", x: 290, y: 55, color: "#D85A30" },
  { label: "Gym", x: 60, y: 145, color: "#1D9E75" },
  { label: "Dorm A", x: 310, y: 150, color: "#D4537E" },
  { label: "Cafeteria", x: 130, y: 200, color: "var(--brand-primary)" },
  { label: "Quad", x: 200, y: 110, color: "#1D9E75" },
];

export interface MapTeaserProps {
  /** URL of the real MappedIn viewer for this campus. */
  mapHref: string;
}

/**
 * Right-column card on the hero — a "Campus map" panel with a
 * live indicator dot, an illustrated overview, and four filter
 * pills underneath. Tap anywhere → drops the visitor into the
 * real MappedIn viewer at `mapHref`. The illustration is decoration
 * only; the pills are visual today and gain behaviour when we ship
 * categories on the real map in a later arc.
 */
export function MapTeaser({ mapHref }: MapTeaserProps) {
  return (
    <div className="rounded-2xl border border-[var(--brand-line)] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[#1D9E75]"
          />
          <span className="text-sm font-medium text-[var(--brand-text)]">
            Campus map
          </span>
        </div>
        <Link
          href={mapHref}
          className="text-xs font-medium text-[var(--brand-text-muted)] transition-colors hover:text-[var(--brand-primary)]"
        >
          Open ↗
        </Link>
      </div>

      <Link
        href={mapHref}
        aria-label="Open campus map"
        className="mt-4 block overflow-hidden rounded-xl"
      >
        <svg
          viewBox="0 0 380 250"
          xmlns="http://www.w3.org/2000/svg"
          className="block h-auto w-full"
          role="img"
          aria-label="Illustrated campus map"
        >
          <rect width="380" height="250" fill="#E0F2EE" />
          {/* Cross-shaped walking paths */}
          <line
            x1="0"
            y1="125"
            x2="380"
            y2="125"
            stroke="#fff"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.7"
          />
          <line
            x1="190"
            y1="0"
            x2="190"
            y2="250"
            stroke="#fff"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.7"
          />
          {BUILDINGS.map((b) => (
            <g key={b.label}>
              <circle cx={b.x} cy={b.y} r="7" fill={b.color} />
              <text
                x={b.x}
                y={b.y + 22}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="#1A1A1A"
              >
                {b.label}
              </text>
            </g>
          ))}
        </svg>
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTER_PILLS.map((p) => (
          <span
            key={p.label}
            className={
              p.active
                ? "rounded-full px-3 py-1 text-xs font-medium text-white"
                : "rounded-full border border-[var(--brand-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--brand-text-muted)]"
            }
            style={
              p.active ? { backgroundColor: "var(--brand-primary)" } : undefined
            }
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
