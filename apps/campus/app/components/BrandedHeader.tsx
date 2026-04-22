"use client";

import { Box } from "@mui/material";

interface Props {
  logo?: string;
  alt?: string;
}

/**
 * Floating top-left logo chip for the public viewer. No-op when no logo
 * URL is provided — keeps the public viewer clean until a campus opts in.
 */
export default function BrandedHeader({ logo, alt = "Logo" }: Props) {
  if (!logo) return null;
  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1400,
        px: 2,
        py: 1,
        bgcolor: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        borderRadius: 2,
        boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={alt}
        style={{ maxHeight: 32, maxWidth: 220, display: "block" }}
      />
    </Box>
  );
}
