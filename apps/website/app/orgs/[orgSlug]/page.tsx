"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ProjectsGrid } from "@/components/projects-grid";
import { organizationFetcher } from "@/lib/api";
import type { PublishedProject } from "@/lib/organizations";

function OrgHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 grid-field" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 h-[600px] w-[600px] rounded-full bg-accent-soft blur-3xl"
      />
      <div className="relative z-10 mx-auto max-w-container px-6 py-24 md:px-8 md:py-32">
        <div className="max-w-2xl">
          <Link
            href="/orgs"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            ← Organizations
          </Link>
          <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function OrgSlugPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  const { data, isLoading, error } = useSWR(
    orgSlug ? `/api/orgs/${orgSlug}` : null,
    organizationFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0,
    },
  );

  const organization = data?.organization;
  const projects: PublishedProject[] = (data?.projects || []).map((p) => ({
    ...p,
    updatedAt:
      typeof p.updatedAt === "string" ? new Date(p.updatedAt) : p.updatedAt,
  }));

  if (isLoading) {
    return <OrgHero title="Loading…" />;
  }

  if (error || !organization) {
    return (
      <OrgHero
        title="Organization not found"
        subtitle="The organization you're looking for doesn't exist or has been removed."
      />
    );
  }

  return (
    <div>
      <OrgHero
        title={organization.name}
        subtitle="Published worlds and projects."
      />
      <section className="border-t border-line-soft py-20 md:py-28">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <ProjectsGrid projects={projects} />
        </div>
      </section>
    </div>
  );
}
