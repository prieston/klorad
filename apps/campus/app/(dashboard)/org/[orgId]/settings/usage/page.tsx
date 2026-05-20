import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import MapIcon from "@mui/icons-material/Map";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ApartmentIcon from "@mui/icons-material/Apartment";
import { Panel } from "@klorad/design-system";

export default async function SettingsUsagePage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return (
    <div className="w-full space-y-10 px-6 py-8 md:px-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<MapIcon fontSize="small" />}
          value="—"
          label="Campus maps"
        />
        <StatCard
          icon={<PlaceIcon fontSize="small" />}
          value="—"
          label="Total POIs"
        />
        <StatCard
          icon={<ApartmentIcon fontSize="small" />}
          value="—"
          label="Floor plans"
        />
        <StatCard
          icon={<VisibilityIcon fontSize="small" />}
          value="—"
          label="Views (30d)"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Plan
        </h2>
        <Panel className="rounded-2xl p-5">
          <div className="text-sm font-semibold text-text-primary">
            Pro · €5k / yr
          </div>
          <p className="mt-1 max-w-prose text-sm text-text-secondary">
            Detailed usage, plan limits, and invoicing land here once billing is
            wired. Contact us to adjust your plan meanwhile.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Panel className="rounded-2xl p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="mt-4 text-2xl font-light text-text-primary">{value}</div>
      <div className="mt-0.5 text-sm text-text-secondary">{label}</div>
    </Panel>
  );
}
