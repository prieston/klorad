"use client";

import { alpha, createTheme, Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

const PRIMARY_BASE = "#6B9CD8";
const PRIMARY_ACTIVE = "#4B6FAF";

export const createAppTheme = (mode: ThemeMode): Theme =>
  createTheme({
    shape: {
      borderRadius: 4,
    },
    palette: {
      mode,
      primary: {
        main: PRIMARY_BASE,
        dark: PRIMARY_ACTIVE,
        light: "#87ADD9",
        contrastText: "#FFFFFF",
      },
      secondary: { main: mode === "dark" ? "#94a3b8" : "#646464" },
      background: {
        default: mode === "dark" ? "#0E0F10" : "#ffffff",
        paper: mode === "dark" ? "#14171A" : "#f8fafc",
      },
      text: {
        primary: mode === "dark" ? "#FFFFFF" : "#0f172a",
        secondary: mode === "dark" ? "rgba(255, 255, 255, 0.65)" : "#475569",
      },
      divider:
        mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.12)",
      error: { main: mode === "dark" ? "#FF5656" : "#ef4444" },
    },
    typography: {
      fontFamily: `"Inter", "system-ui", "Roboto", "Arial", sans-serif`,
      h1: {
        fontWeight: 500,
        fontSize: "2.5rem",
      },
      h2: {
        fontWeight: 500,
        fontSize: "2rem",
      },
      h3: {
        fontWeight: 500,
        fontSize: "1.75rem",
      },
      body1: { fontSize: "1rem", fontWeight: 400 },
      button: { textTransform: "none", fontWeight: 500 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: "var(--color-bg)",
            color: "var(--color-text-primary)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: "var(--color-bg)",
            borderBottom: "1px solid var(--color-border)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: "var(--color-surface-1)",
            borderRight: "1px solid var(--color-border)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 1px 3px rgba(0,0,0,0.35)"
                : "0 2px 6px rgba(15, 23, 42, 0.08)",
            borderRadius: 4,
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            "& .MuiOutlinedInput-notchedOutline": {
              borderRadius: 4,
            },
          },
          input: {
            borderRadius: 4,
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            borderRadius: 4,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            padding: "6px 14px",
            fontWeight: 500,
            boxShadow: "none",
          },
          // Klorad "ghost primary" — dark card background, primary-coloured
          // text, primary-tinted border. Matches the look the editor/admin
          // already apply via per-callsite `sx` overrides; centralising it
          // here makes new apps (campus, culture) look identical for free.
          containedPrimary: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#161B20"
                : theme.palette.background.paper,
            color: theme.palette.primary.main,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            boxShadow: "none",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#1a1f26"
                  : alpha(theme.palette.primary.main, 0.05),
              borderColor: alpha(theme.palette.primary.main, 0.5),
              boxShadow: "none",
            },
            "&:active": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#1a1f26"
                  : alpha(theme.palette.primary.main, 0.1),
              boxShadow: "none",
            },
            "&.Mui-disabled": {
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              color: alpha(theme.palette.primary.main, 0.3),
              borderColor: alpha(theme.palette.primary.main, 0.1),
            },
          }),
          outlined: ({ theme }) => ({
            borderColor:
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.24)"
                : "rgba(107, 156, 216, 0.35)",
            color: theme.palette.text.primary,
            "&:hover": {
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.45)"
                  : "rgba(95, 136, 199, 0.5)",
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(107, 156, 216, 0.08)"
                  : "rgba(107, 156, 216, 0.1)",
            },
          }),
          outlinedError: {
            borderColor: "#FF5656",
            color: "#FF5656",
            backgroundColor: "transparent",
            "&:hover": {
              borderColor: "#FF5656",
              backgroundColor: "rgba(255, 86, 86, 0.12)",
            },
          },
          text: ({ theme }) => ({
            color:
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.75)"
                : theme.palette.primary.main,
            padding: "4px 8px",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(107, 156, 216, 0.08)"
                  : "rgba(107, 156, 216, 0.08)",
            },
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: "var(--color-surface-2)",
            boxShadow: "none",
            borderRadius: 4,
            border: "1px solid var(--color-border)",
          },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          root: {
            fontSize: "1.25rem",
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            padding: "6px",
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 4,
          },
        },
      },
    },
  });

const theme: Theme = createAppTheme("dark");
export default theme;
