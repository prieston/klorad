import React from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

export interface PageContentProps {
  children: React.ReactNode;
  maxWidth?: "5xl" | "6xl" | "full";
  className?: string;
  /** Override the default top margin (defaults to 6 = 48px for PageHeader gap). Pass 0 when there's no header above. */
  sx?: SxProps<Theme>;
}

/**
 * Content surface component for displaying tables, cards, grids, forms, etc.
 * Provides consistent card styling with glass morphism effect.
 * Content is constrained to max-width for better readability.
 */
export const PageContent: React.FC<PageContentProps> = ({
  children,
  maxWidth = "5xl",
  className,
  sx,
}) => {
  const maxWidthMap = {
    "5xl": "1280px",
    "6xl": "1536px",
    full: "100%",
  };

  return (
    <Box
      className={className}
      sx={[
        {
          maxWidth: maxWidthMap[maxWidth],
          mt: 6, // Default: add spacing from PageHeader/PageDescription
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
};

