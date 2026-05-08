"use client";

import { Box } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export interface Crumb {
  label: string;
  onClick: () => void;
  current: boolean;
}

/**
 * Tiny shared breadcrumb strip used by the studio's right-panel
 * detail screens (Buildings → Block A → Floor 1 → Room 204; POIs →
 * Library Café). Last crumb is the current page (bold, non-clickable);
 * earlier crumbs jump back up the stack.
 */
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        flexWrap: "wrap",
        px: 2,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      {crumbs.map((c, i) => (
        <Box
          key={`${i}-${c.label}`}
          sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
        >
          {i > 0 && (
            <ChevronRightIcon sx={{ fontSize: 14, color: "text.secondary" }} />
          )}
          <Box
            component="button"
            onClick={c.current ? undefined : c.onClick}
            disabled={c.current}
            sx={{
              border: "none",
              background: "none",
              px: 0.5,
              py: 0.25,
              fontSize: "0.8125rem",
              fontWeight: c.current ? 700 : 500,
              color: c.current ? "text.primary" : "text.secondary",
              cursor: c.current ? "default" : "pointer",
              "&:hover": c.current ? {} : { color: "primary.main" },
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
