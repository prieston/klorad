"use client";

import { Box, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { LOCALES, useLocale, useSetLocale, type Locale } from "../lib/i18n";

const LABELS: Record<Locale, string> = { en: "EN", el: "ΕΛ" };

export default function LocaleToggle() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        bgcolor: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: 8,
        p: 0.25,
        backdropFilter: "blur(8px)",
      }}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <Tooltip key={l} title={l === "en" ? "English" : "Ελληνικά"} arrow>
            <Box
              component="button"
              onClick={() => setLocale(l)}
              sx={(t) => ({
                minWidth: 34,
                height: 28,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                bgcolor: active ? alpha(t.palette.primary.main, 0.22) : "transparent",
                color: active ? "primary.main" : "var(--glass-text-secondary, #bbb)",
                transition: "all 0.15s ease",
                "&:hover": { color: "primary.main" },
              })}
            >
              {LABELS[l]}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
