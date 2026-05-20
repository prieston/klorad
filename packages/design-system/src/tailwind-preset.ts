import type { Config } from "tailwindcss";

/**
 * Shared Tailwind preset for every Klorad app.
 *
 * Each app's `tailwind.config.ts` extends this:
 *
 *   import preset from "@klorad/design-system/tailwind-preset";
 *   export default {
 *     presets: [preset],
 *     content: [
 *       "./app/**\/*.{ts,tsx}",
 *       "../../packages/design-system/src/**\/*.{ts,tsx}",
 *     ],
 *   } satisfies Config;
 *
 * Colors resolve to the CSS variables defined in `tokens.css`, so they
 * flip automatically between light and dark.
 */
const preset: Omit<Config, "content"> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        glass: {
          DEFAULT: "var(--glass-bg)",
          border: "var(--glass-border)",
          highlight: "var(--glass-highlight)",
        },
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "line-soft": "var(--line-soft)",
        "line-strong": "var(--line-strong)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          contrast: "var(--accent-contrast)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        container: "1200px",
      },
      boxShadow: {
        glass: "0 16px 50px -20px rgba(0, 0, 0, 0.45)",
        glow: "0 0 80px -16px var(--accent-glow)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
};

export default preset;
