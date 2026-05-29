import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Accessibility, Building2, Eye, MapPin } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { StatCard } from "@/app/(dashboard)/components/StatCard";

/**
 * Org Usage — quick plan + counters page. Lives at /settings/usage as
 * a sibling of /settings/general because the broader IA rebuild keeps
 * URL paths stable. Numbers are placeholders until the analytics
 * arc lands; rendering "—" keeps trust intact.
 */
export default async function SettingsUsagePage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Organisation"
        title="Usage"
        subtitle="Plan, limits, counters across every campus."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Building2 size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="Campuses"
        />
        <StatCard
          icon={<MapPin size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="POIs across maps"
        />
        <StatCard
          icon={<Accessibility size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="Accessible POIs"
        />
        <StatCard
          icon={<Eye size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="Public views (30d)"
        />
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Plan
        </h2>
        <Panel className="rounded-2xl p-5">
          <div className="text-sm font-semibold text-text-primary">
            Pro · €5k / yr
          </div>
          <p className="mt-1 max-w-prose text-sm text-text-secondary">
            Detailed usage, plan limits, and invoicing land here once billing
            is wired. Contact us to adjust your plan in the meantime.
          </p>
        </Panel>
      </section>
    </div>
  );
}
