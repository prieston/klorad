"use client";

import {
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import LaunchIcon from "@mui/icons-material/Launch";
import type { HealthFixTarget, ProjectHealth } from "@/app/hooks/useProjectHealth";

interface Props {
  health: ProjectHealth;
  onFix: (target: HealthFixTarget) => void;
}

/**
 * The studio's "Project Health" rail — purely informative. Lives on the
 * left side as a counterpart to the right workflow panel: shows the
 * completeness checklist, counts, lints with a "Fix →" jump that hands
 * back the offending entity, and a single context-aware tip.
 */
export default function ProjectHealthPanel({ health, onFix }: Props) {
  const { counts, completeness, issues, tip } = health;
  const allDone = completeness.every((c) => c.done);

  return (
    <Box
      className="glass-panel"
      sx={{
        position: "fixed",
        left: 16,
        top: 16,
        bottom: 16,
        width: 280,
        zIndex: 1399,
        display: "flex",
        flexDirection: "column",
        bgcolor: "var(--glass-bg)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        border: "1px solid var(--glass-border)",
        borderRadius: 2,
        boxShadow: "0 4px 24px rgba(0,0,0,0.32)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "text.secondary",
            flex: 1,
          }}
        >
          Project health
        </Typography>
        {issues.length > 0 ? (
          <Chip
            size="small"
            label={`${issues.length}`}
            sx={(t) => ({
              height: 20,
              fontSize: "0.7rem",
              bgcolor: alpha(t.palette.warning.main, 0.18),
              color: "warning.main",
              fontWeight: 600,
            })}
          />
        ) : allDone ? (
          <Chip
            size="small"
            label="Ready"
            sx={(t) => ({
              height: 20,
              fontSize: "0.7rem",
              bgcolor: alpha(t.palette.success.main, 0.18),
              color: "success.main",
              fontWeight: 600,
            })}
          />
        ) : null}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
        {/* Completeness checklist */}
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {completeness.map((c) => (
            <Stack
              key={c.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ minHeight: 22 }}
            >
              {c.done ? (
                <CheckCircleIcon
                  sx={{ fontSize: 16, color: "success.main" }}
                />
              ) : (
                <RadioButtonUncheckedIcon
                  sx={{ fontSize: 16, color: "text.disabled" }}
                />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontSize: "0.8125rem",
                  color: c.done ? "text.secondary" : "text.primary",
                  textDecoration: c.done ? "line-through" : "none",
                }}
              >
                {c.label}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Counts */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="overline"
            sx={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "text.secondary",
              display: "block",
              mb: 0.5,
            }}
          >
            Counts
          </Typography>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              color: "text.secondary",
            }}
          >
            {counts.buildings} buildings · {counts.floors} floors ·{" "}
            {counts.rooms} rooms · {counts.pois} POIs
          </Typography>
        </Box>

        {/* Issues */}
        {issues.length > 0 && (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Typography
              variant="overline"
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "text.secondary",
                display: "block",
                mb: 0.5,
              }}
            >
              Issues
            </Typography>
            <Stack spacing={0.25} sx={{ mb: 2 }}>
              {issues.map((i) => (
                <Box
                  key={i.id}
                  sx={(t) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor:
                      i.severity === "error"
                        ? alpha(t.palette.error.main, 0.06)
                        : alpha(t.palette.warning.main, 0.06),
                  })}
                >
                  {i.severity === "error" ? (
                    <ErrorOutlineIcon
                      sx={{ fontSize: 14, color: "error.main", flexShrink: 0 }}
                    />
                  ) : (
                    <WarningAmberIcon
                      sx={{ fontSize: 14, color: "warning.main", flexShrink: 0 }}
                    />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      flex: 1,
                      fontSize: "0.75rem",
                      lineHeight: 1.3,
                    }}
                  >
                    {i.label}
                  </Typography>
                  {i.fix && (
                    <Tooltip title="Open in right panel">
                      <IconButton
                        size="small"
                        onClick={() => onFix(i.fix!)}
                        sx={{ p: 0.25 }}
                      >
                        <LaunchIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Box>

      {/* Tip */}
      <Box
        sx={(t) => ({
          px: 2,
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(t.palette.primary.main, 0.04),
          display: "flex",
          gap: 1,
          alignItems: "flex-start",
        })}
      >
        <LightbulbOutlinedIcon
          sx={{ fontSize: 16, color: "primary.main", flexShrink: 0, mt: 0.25 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: "0.75rem", lineHeight: 1.4 }}
        >
          {tip.replace(/^Tip:\s*/, "")}
        </Typography>
      </Box>
    </Box>
  );
}
