import React from "react";
import { Box } from "@mui/material";

export interface PageProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Horizontal offset for the page when the host app has a fixed left
   * sidebar. Defaults to 392 (editor's sidebar width). Pass 0 when the
   * app uses MUI's persistent Drawer (which reserves its own space).
   */
  sidebarOffset?: number | string;
}

/**
 * Main page wrapper component for dashboard pages.
 * Provides consistent layout structure and spacing.
 */
export const Page: React.FC<PageProps> = ({
  children,
  className,
  sidebarOffset = 392,
}) => {
  return (
    <Box
      className={className}
      sx={{
        marginLeft: typeof sidebarOffset === "number" ? `${sidebarOffset}px` : sidebarOffset,
        padding: "24px",
        paddingX: 0,
        minHeight: "100vh",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Box sx={{ paddingX: "24px" }}>{children}</Box>
    </Box>
  );
};

