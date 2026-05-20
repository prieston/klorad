import type { Config } from "tailwindcss";
import preset from "@klorad/design-system/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/design-system/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy aliases — keep pre-redesign pages rendering during the
        // phased rebuild; removed once every page is on the new system.
        "base-bg": "var(--base-bg)",
        "base-bg-alt": "var(--base-bg-alt)",
      },
    },
  },
};

export default config;
