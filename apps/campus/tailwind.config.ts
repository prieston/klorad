import type { Config } from "tailwindcss";
import preset from "@klorad/design-system/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    // `lib/` holds the public-surface components (`lib/consumer/`,
    // `lib/mappedin/`, …) — scan it too or Tailwind's JIT skips the
    // arbitrary values that don't also appear under `app/` (e.g.
    // `max-w-[1280px]`, `grid-cols-[1.1fr_0.9fr]`, `bg-[var(--…)]`)
    // and the layout silently collapses.
    "./lib/**/*.{ts,tsx}",
    // Scan the shared design system so its component classes are generated.
    "../../packages/design-system/src/**/*.{ts,tsx}",
  ],
  corePlugins: {
    // Preflight is off while MUI and Tailwind coexist: Tailwind only adds
    // utilities here, it does not reset element styles. Re-enable once the
    // last MUI screen is migrated (end of Phase 2).
    preflight: false,
  },
};

export default config;
