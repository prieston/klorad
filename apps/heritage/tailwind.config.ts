import type { Config } from "tailwindcss";
import preset from "@klorad/design-system/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/design-system/src/**/*.{ts,tsx}",
  ],
};

export default config;
