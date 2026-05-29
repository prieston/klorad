"use client";

import { MapPin } from "lucide-react";

interface RoomItem {
  id: string;
  name: string;
}

interface Props {
  /** Room/space list for this building. */
  rooms: RoomItem[];
  /** Currently-selected room id (if any) — drives the active row
   *  highlight. */
  selectedRoomId?: string;
  /** EN/EL strings. */
  locale: "en" | "el";
  /** Called when the visitor taps a room — zooms the map to it. */
  onSelectRoom: (id: string) => void;
}

const COPY = {
  en: {
    noRooms: "No rooms in this building yet.",
  },
  el: {
    noRooms: "Δεν υπάρχουν δωμάτια.",
  },
} as const;

/**
 * Building-detail panel that takes over the scrollable bottom
 * container on the map page. Shows the building name + initials
 * chip up top, the rooms list (filtered to this building's spaces)
 * in the middle, and a primary "Get directions" CTA pinned at the
 * bottom of the scroll surface. Rooms render in the same row style
 * as the buildings list — soft tinted row + matching chips on the
 * left and right.
 */
export function BuildingDetailSheet({
  rooms,
  selectedRoomId,
  locale,
  onSelectRoom,
}: Props) {
  const copy = COPY[locale];
  return (
    <section className="mx-auto max-w-[760px] px-4 pt-3 md:px-6">
      <div>
        {rooms.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-[var(--brand-text-muted)]">
            {copy.noRooms}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((r) => {
              const active = r.id === selectedRoomId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRoom(r.id)}
                    aria-current={active ? "true" : undefined}
                    className="flex w-full items-center gap-3 rounded-2xl border border-solid px-3 py-2.5 text-left"
                    style={
                      active
                        ? {
                            backgroundColor:
                              "color-mix(in srgb, var(--brand-primary) 7%, #ffffff)",
                            borderColor: "var(--brand-primary)",
                          }
                        : {
                            backgroundColor:
                              "color-mix(in srgb, var(--brand-primary) 3%, #ffffff)",
                            borderColor: "transparent",
                          }
                    }
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <MapPin size={16} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--brand-text)]">
                      {r.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </section>
  );
}
