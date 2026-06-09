/**
 * Re-export shim. The real implementation lives in `@klorad/secrets`
 * so every vertical can reuse it. Kept here so existing
 * `import "@/lib/secrets"` call-sites in the Campus API routes
 * continue to work without touching them.
 */
export {
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsEnabled,
} from "@klorad/secrets";
