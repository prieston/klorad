import type { Config } from "tailwindcss";
import preset from "@klorad/design-system/tailwind-preset";

/**
 * Admin extends the shared design-system preset (Klorad teal accent, Inter,
 * `--bg` / `--accent` / etc.). The legacy admin class names — `text-primary`,
 * `bg-primary`, `bg-surface-1`, `border-border`, `text-success` … — are kept
 * as colour aliases that now resolve to the new tokens, so the bulk of the
 * existing markup keeps rendering without a class-name sweep.
 */
const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/design-system/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy admin aliases — every name re-points at the design-system
        // tokens. Remove once the components have been swept to use the
        // canonical DS names (`text-text-primary`, `bg-accent`, …).
        border: "var(--line-soft)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
        primary: {
          DEFAULT: "var(--accent)",
          400: "var(--accent)",
          600: "var(--accent-hover)",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
        info: "var(--accent)",
      },
    },
  },
};

export default config;
