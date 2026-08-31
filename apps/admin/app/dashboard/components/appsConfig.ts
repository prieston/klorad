export const KLORAD_APPS = [
  { key: "editor", label: "Editor", description: "Klorad Studio / 3D scene editor" },
  { key: "campus", label: "Campus", description: "Topos Campus — 3D campus maps" },
  {
    key: "heritage",
    label: "Heritage",
    description:
      "Klorad Heritage — photorealistic cultural heritage: scanned sites, captured artifacts, provenance and rights",
  },
  {
    key: "mobility",
    label: "Mobility",
    description:
      "Klorad Mobility — traffic-management dashboard (ATMS cameras, dynamic signs, traveller map)",
  },
] as const;

export type KloradApp = (typeof KLORAD_APPS)[number]["key"];
