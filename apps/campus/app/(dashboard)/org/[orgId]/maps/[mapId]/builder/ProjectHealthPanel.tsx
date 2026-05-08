"use client";

import {
  Box,
  CircularProgress,
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
import ApartmentIcon from "@mui/icons-material/Apartment";
import LayersIcon from "@mui/icons-material/Layers";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import type {
  HealthFixTarget,
  ProjectHealth,
} from "@/app/hooks/useProjectHealth";

interface Props {
  health: ProjectHealth;
  onFix: (target: HealthFixTarget) => void;
}

/**
 * The studio's "Project Health" rail — purely informative. Lives on the
 * left side as a counterpart to the right workflow panel: shows a
 * circular completion gauge, a 2×2 grid of stat tiles, the
 * checklist, lints with a "Fix →" jump, and a context-aware tip.
 */
export default function ProjectHealthPanel({ health, onFix }: Props) {
  const { counts, completeness, issues, tip } = health;
  const doneCount = completeness.filter((c) => c.done).length;
  const total = completeness.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const allDone = doneCount === total && total > 0;

  return (
    <Box
      className="glass-panel"
      sx={{
        position: "fixed",
        left: 16,
        top: 16,
        bottom: 16,
        width: 300,
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
      {/* ----------------------------- Hero ------------------------------ */}
      <Box
        sx={(t) => ({
          px: 2.5,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.18)} 0%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
          display: "flex",
          alignItems: "center",
          gap: 2,
        })}
      >
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={56}
            thickness={4}
            sx={(t) => ({
              color: alpha(t.palette.primary.main, 0.15),
              position: "absolute",
            })}
          />
          <CircularProgress
            variant="determinate"
            value={pct}
            size={56}
            thickness={4}
            sx={(t) => ({
              color: allDone ? t.palette.success.main : t.palette.primary.main,
            })}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ fontSize: "0.75rem" }}
            >
              {pct}%
            </Typography>
          </Box>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "text.secondary",
              display: "block",
              lineHeight: 1.2,
            }}
          >
            Project health
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
            {allDone
              ? "Ready to share"
              : doneCount === 0
                ? "Let's set this up"
                : `${doneCount} of ${total} done`}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.7rem" }}
          >
            {issues.length === 0
              ? "No issues found"
              : `${issues.length} thing${issues.length === 1 ? "" : "s"} to look at`}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
        {/* ----------------------------- Stats ----------------------------- */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            mb: 2.5,
          }}
        >
          <StatTile
            icon={<ApartmentIcon sx={{ fontSize: 16 }} />}
            label="Buildings"
            value={counts.buildings}
          />
          <StatTile
            icon={<LayersIcon sx={{ fontSize: 16 }} />}
            label="Floors"
            value={counts.floors}
          />
          <StatTile
            icon={<MeetingRoomIcon sx={{ fontSize: 16 }} />}
            label="Rooms"
            value={counts.rooms}
          />
          <StatTile
            icon={<AddLocationAltIcon sx={{ fontSize: 16 }} />}
            label="POIs"
            value={counts.pois}
          />
        </Stack>

        {/* -------------------------- Checklist -------------------------- */}
        <Typography
          variant="overline"
          sx={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "text.secondary",
            display: "block",
            mb: 0.75,
          }}
        >
          Checklist
        </Typography>
        <Stack spacing={0.5} sx={{ mb: 2.5 }}>
          {completeness.map((c) => (
            <Stack
              key={c.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ minHeight: 24 }}
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

        {/* ---------------------------- Issues --------------------------- */}
        {issues.length > 0 && (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Typography
              variant="overline"
              sx={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "text.secondary",
                display: "block",
                mb: 0.75,
              }}
            >
              Issues ({issues.length})
            </Typography>
            <Stack spacing={0.5}>
              {issues.map((i) => (
                <Box
                  key={i.id}
                  sx={(t) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1,
                    py: 0.875,
                    borderRadius: 1,
                    bgcolor:
                      i.severity === "error"
                        ? alpha(t.palette.error.main, 0.08)
                        : alpha(t.palette.warning.main, 0.08),
                    border: "1px solid",
                    borderColor:
                      i.severity === "error"
                        ? alpha(t.palette.error.main, 0.2)
                        : alpha(t.palette.warning.main, 0.2),
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

      {/* ------------------------------- Tip ------------------------------- */}
      <Box
        sx={(t) => ({
          px: 2,
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(t.palette.primary.main, 0.06),
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
          sx={{ fontSize: "0.75rem", lineHeight: 1.45 }}
        >
          {tip.replace(/^Tip:\s*/, "")}
        </Typography>
      </Box>
    </Box>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Box
      sx={(t) => ({
        px: 1.25,
        py: 1,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(t.palette.background.paper, 0.4),
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
      })}
    >
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box sx={{ color: "primary.main", display: "inline-flex" }}>{icon}</Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: "0.65rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </Typography>
      </Stack>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ fontSize: "1.25rem", lineHeight: 1.1 }}
      >
        {value}
      </Typography>
    </Box>
  );
}
