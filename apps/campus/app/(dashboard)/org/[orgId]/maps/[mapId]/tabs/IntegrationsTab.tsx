"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import EventIcon from "@mui/icons-material/Event";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import FacebookIcon from "@mui/icons-material/Facebook";
import { PageCard, PageSection } from "@klorad/ui";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "available" | "deferred";
}

const INTEGRATIONS: Integration[] = [
  {
    id: "google",
    name: "Google Calendar",
    description: "Sync events from any Google Calendar. Attach calendars to POIs so events appear at the right building.",
    icon: <CalendarMonthIcon />,
    status: "available",
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    description: "Pull events from your institution's Exchange or Microsoft 365 tenant.",
    icon: <EventIcon />,
    status: "available",
  },
  {
    id: "ics",
    name: "ICS feeds",
    description: "Subscribe to any public ICS URL. Universal fallback for calendars that don't expose a formal API.",
    icon: <RssFeedIcon />,
    status: "available",
  },
  {
    id: "facebook",
    name: "Facebook Events",
    description: "Surface your page's public events on the map. Coming in a later phase.",
    icon: <FacebookIcon />,
    status: "deferred",
  },
];

export default function IntegrationsTab() {
  return (
    <Stack spacing={4} sx={{ mt: 3 }}>
      <PageSection title="Event feeds" spacing="tight">
        <Stack spacing={2}>
          {INTEGRATIONS.map((int) => (
            <PageCard key={int.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={(t) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 1,
                    bgcolor: alpha(t.palette.primary.main, 0.12),
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  })}
                >
                  {int.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {int.name}
                    </Typography>
                    {int.status === "deferred" && (
                      <Chip label="Later" size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {int.description}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  disabled
                  sx={{ textTransform: "none", flexShrink: 0 }}
                >
                  {int.status === "deferred" ? "Not yet" : "Connect"}
                </Button>
              </Box>
            </PageCard>
          ))}
        </Stack>
      </PageSection>
    </Stack>
  );
}
