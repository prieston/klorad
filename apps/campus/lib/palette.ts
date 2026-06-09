/**
 * Re-export shim. The real palette generator lives in
 * `@klorad/design-system/palette` so every vertical can reuse it.
 * Kept here so existing `import "@/lib/palette"` call-sites in
 * Campus (consumer layout + identity settings) continue to work
 * without touching them. The Campus-specific aliases stay too — the
 * function and type behave identically; only the names were
 * generalised on extraction.
 */
export {
  derivePalette as deriveCampusPalette,
  paletteToCssVars,
  type BrandPalette as CampusPalette,
} from "@klorad/design-system/palette";
