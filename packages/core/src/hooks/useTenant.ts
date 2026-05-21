"use client";

import { useEffect, useState } from "react";

export type TenantId = "klorad" | "psmdt";

export interface TenantConfig {
  id: TenantId;
  name: string;
  domain: string;
  logo: string;
  logoAlt: string;
  logoWidth: number;
  logoHeight: number;
  poweredBy?: string;
}

const tenantConfigs: Record<TenantId, TenantConfig> = {
  klorad: {
    id: "klorad",
    name: "Klorad Studio",
    domain: "klorad.com",
    // The canonical multi-color brand asset — kept on the config so
    // any future consumer (download, share image, exported viewer)
    // can reach it. The editor's AppBar specifically renders the
    // inline `KloradMark` from `@klorad/design-system` instead of
    // this image, so its dark-on-dark rendering doesn't matter here.
    logo: "/images/logo/klorad-logo-new.svg",
    logoAlt: "Klorad Studio",
    logoWidth: 383,
    logoHeight: 78,
  },
  psmdt: {
    id: "psmdt",
    name: "PSMDT",
    domain: "psm.klorad.com",
    logo: "/images/logo/psm-logo-new.png",
    logoAlt: "PSMDT",
    logoWidth: 650,
    logoHeight: 106,
    poweredBy: "Powered by Klorad",
  },
};

function detectTenant(hostname?: string): TenantId {
  if (!hostname) return "klorad";

  // Check for PSMDT domain
  if (hostname.includes("psm.klorad.com") || hostname.startsWith("psm.")) {
    return "psmdt";
  }

  // Default to Klorad
  return "klorad";
}

export function useTenant(): TenantConfig {
  const [tenant, setTenant] = useState<TenantConfig>(tenantConfigs.klorad);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tenantId = detectTenant(window.location.hostname);
      setTenant(tenantConfigs[tenantId]);
    }
  }, []);

  return tenant;
}

// Server-side detection helper
export function getTenantFromHostname(hostname?: string): TenantConfig {
  const tenantId = detectTenant(hostname);
  return tenantConfigs[tenantId];
}

