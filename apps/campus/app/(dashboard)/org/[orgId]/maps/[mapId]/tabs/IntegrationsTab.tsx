"use client";

import type { ReactNode } from "react";
import EventIcon from "@mui/icons-material/Event";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import FacebookIcon from "@mui/icons-material/Facebook";
import { Badge, Button, Panel } from "@klorad/design-system";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  status: "available" | "deferred";
}

const INTEGRATIONS: Integration[] = [
  {
    id: "google",
    name: "Google Calendar",
    description:
      "Sync events from any Google Calendar. Attach calendars to POIs so events appear at the right building.",
    icon: <CalendarMonthIcon />,
    status: "available",
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    description:
      "Pull events from your institution's Exchange or Microsoft 365 tenant.",
    icon: <EventIcon />,
    status: "available",
  },
  {
    id: "ics",
    name: "ICS feeds",
    description:
      "Subscribe to any public ICS URL. Universal fallback for calendars that don't expose a formal API.",
    icon: <RssFeedIcon />,
    status: "available",
  },
  {
    id: "facebook",
    name: "Facebook Events",
    description:
      "Surface your page's public events on the map. Coming in a later phase.",
    icon: <FacebookIcon />,
    status: "deferred",
  },
];

export default function IntegrationsTab() {
  return (
    <div className="space-y-4 pt-6">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
        Event feeds
      </h2>
      <div className="space-y-3">
        {INTEGRATIONS.map((int) => (
          <Panel key={int.id} className="flex items-center gap-4 rounded-2xl p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              {int.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  {int.name}
                </span>
                {int.status === "deferred" && <Badge>Later</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-text-secondary">
                {int.description}
              </p>
            </div>
            <Button variant="secondary" size="sm" disabled className="shrink-0">
              {int.status === "deferred" ? "Not yet" : "Connect"}
            </Button>
          </Panel>
        ))}
      </div>
    </div>
  );
}
