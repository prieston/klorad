// packages/dev-audits/src/profiles/klorad/klorad.manifest.ts
/**
 * Klorad project manifest - defines architectural invariants
 */

export interface KloradManifest {
  packages: {
    core: string;
    ui: string;
    engineCesium: string;
    engineMapbox: string;
    engineThree: string;
    ionSdk: string;
  };
  domains: {
    organisation: string; // apps/editor/app/(protected)/org/[orgId]
    project: string; // apps/editor/app/(protected)/org/[orgId]/projects
  };
  dependencyRules: {
    from: string; // package name or pattern (supports * wildcard)
    to?: string; // allowed target pattern (supports * wildcard and regex groups like (core|ui))
    forbidden?: boolean; // when true: edge is forbidden
    // NOTE: Rules use "regex-with-star" format, not pure globs:
    // - * is treated as wildcard (converted to .*)
    // - Parentheses are interpreted as regex groups
    // - Example: "@klorad/(core|ui)" is a regex group, not a glob pattern
  }[];
}

export const kloradManifest: KloradManifest = {
  packages: {
    core: "@klorad/core",
    ui: "@klorad/ui",
    engineCesium: "@klorad/engine-cesium",
    engineMapbox: "@klorad/engine-mapbox",
    engineThree: "@klorad/engine-three",
    ionSdk: "@klorad/ion-sdk",
  },
  domains: {
    organisation: "apps/editor/app/(protected)/org/[orgId]",
    project: "apps/editor/app/(protected)/org/[orgId]/projects",
  },
  dependencyRules: [
    // Core has no internal dependencies (only external deps allowed)
    {
      from: "@klorad/core",
      to: "@klorad/*",
      forbidden: true,
    },
    // Ion SDK may depend on core only (peer)
    {
      from: "@klorad/ion-sdk",
      to: "@klorad/core",
    },
    // Engines may depend on core, ion-sdk, ui
    {
      from: "@klorad/engine-cesium",
      to: "@klorad/(core|ion-sdk|ui)",
    },
    {
      from: "@klorad/engine-three",
      to: "@klorad/(core|ion-sdk|ui|engine-cesium)",
    },
    {
      from: "@klorad/engine-mapbox",
      to: "@klorad/(core|ui)",
    },
    // UI may depend on core
    {
      from: "@klorad/ui",
      to: "@klorad/core",
    },
    // Apps can depend on all packages, not vice-versa
    // (no rule needed - apps are not packages)
    // Packages should not import from apps
    {
      from: "@klorad/*",
      to: "apps/*",
      forbidden: true,
    },
  ],
};
