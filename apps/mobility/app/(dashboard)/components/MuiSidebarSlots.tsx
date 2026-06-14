"use client";

/**
 * Thin client-only re-export of the MUI-backed sidebar slots from
 * `@klorad/ui`. Living in apps/mobility lets `next/dynamic` consume a
 * stable local module specifier — webpack's exports-map resolution
 * for `@klorad/ui` chokes on the dynamic import target when the
 * package is reached through pnpm's symlinked node_modules, so we
 * indirect through this file.
 */
export { OrganizationSwitcher, UserAccountMenu } from "@klorad/ui";
