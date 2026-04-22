export const KLORAD_APPS = [
  { key: "editor", label: "Editor", description: "Klorad Studio / 3D scene editor" },
  { key: "campus", label: "Campus", description: "Topos Campus — 3D campus maps" },
  { key: "culture", label: "Culture", description: "Culture & heritage tours" },
] as const;

export type KloradApp = (typeof KLORAD_APPS)[number]["key"];
