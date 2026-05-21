"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import { useTenant, type TenantConfig } from "@klorad/core";
import { KloradMark } from "@klorad/design-system";

/**
 * The AppBar logo block.
 *
 * For the Klorad tenant we render the design-system `KloradMark` SVG
 * alongside a stacked **Klorad / Studio** wordmark — matching the
 * branding pattern used by the campus dashboard (`KloradMark` +
 * `Klorad / Campus`). The fixed brand colours of `KloradMark` render
 * correctly on the editor's dark surface without any CSS filtering.
 *
 * Other tenants (PSMDT today) keep using their bespoke logo asset
 * via `next/image`, with the existing white-invert filter for PNGs.
 */
export default function LogoHeader() {
  const tenant = useTenant();

  if (tenant.id === "klorad") {
    return <KloradLogo />;
  }
  return <ImageLogo tenant={tenant} />;
}

function KloradLogo() {
  return (
    <Link
      href="/"
      aria-label="Klorad Studio"
      className="flex items-center gap-2.5 no-underline"
    >
      <KloradMark className="h-8 w-auto" />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-text-primary">
          Klorad
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.26em] text-text-tertiary">
          Studio
        </span>
      </span>
    </Link>
  );
}

function ImageLogo({ tenant }: { tenant: TenantConfig }) {
  return (
    <Link href="/" aria-label="Go to Home" style={{ textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 0.5,
        }}
      >
        <Box
          sx={{
            width: 130, // Fixed display width for consistent alignment
            height: "auto",
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <Image
            src={tenant.logo}
            alt={tenant.logoAlt}
            width={tenant.logoWidth}
            height={tenant.logoHeight}
            priority
            style={{
              filter: tenant.logo.endsWith(".png")
                ? "brightness(0) invert(1)"
                : "none",
              display: "block",
              width: "100%",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </Box>
        {tenant.poweredBy && (
          <Link
            href="https://klorad.com/partners"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.75rem",
                color: (theme) => theme.palette.text.secondary,
                opacity: 0.7,
                letterSpacing: "0.02em",
                transition: "opacity 0.2s ease",
                "&:hover": {
                  opacity: 1,
                },
              }}
            >
              {tenant.poweredBy}
            </Typography>
          </Link>
        )}
      </Box>
    </Link>
  );
}
