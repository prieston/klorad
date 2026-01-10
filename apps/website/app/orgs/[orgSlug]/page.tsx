"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { GeometricHint } from "@/components/geometric-hint";
import { ProjectsGrid } from "@/components/projects-grid";
import { organizationFetcher } from "@/lib/api";
import type { PublishedProject } from "@/lib/organizations";

export default function OrgSlugPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  const { data, isLoading, error } = useSWR(
    orgSlug ? `/api/orgs/${orgSlug}` : null,
    organizationFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0, // Disable auto-refresh, but allow manual revalidation
    }
  );

  const organization = data?.organization;
  const projects: PublishedProject[] = (data?.projects || []).map((p) => ({
    ...p,
    updatedAt: typeof p.updatedAt === "string" ? new Date(p.updatedAt) : p.updatedAt,
  }));

  if (isLoading) {
    return (
      <article className="space-y-0">
        <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden mt-[-6rem] pb-28 md:mt-[-8rem]">
          <GeometricHint variant="radial-vignette" />
          <div className="relative mx-auto max-w-container px-6 pt-28 md:px-8 md:pt-32">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="mb-4">
                  <Link
                    href="/orgs"
                    className="text-sm text-text-secondary transition-colors duration-500 hover:text-text-primary"
                  >
                    ← Back to Organizations
                  </Link>
                </div>
                <h1 className="max-w-3xl text-4xl font-light text-text-primary md:text-[54px] md:leading-[1.05]">
                  Loading...
                </h1>
              </div>
            </div>
          </div>
        </section>
        <section className="relative left-1/2 w-screen -translate-x-1/2 bg-[#090D12] pt-36 pb-32 md:pt-44 md:pb-36">
          <div className="relative mx-auto max-w-container px-6 md:px-8">
            <div className="py-24 text-center">
              <p className="text-lg font-light text-text-secondary">
                Loading organization...
              </p>
            </div>
          </div>
        </section>
      </article>
    );
  }

  if (error || !organization) {
    return (
      <article className="space-y-0">
        <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden mt-[-6rem] pb-28 md:mt-[-8rem]">
          <GeometricHint variant="radial-vignette" />
          <div className="relative mx-auto max-w-container px-6 pt-28 md:px-8 md:pt-32">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="mb-4">
                  <Link
                    href="/orgs"
                    className="text-sm text-text-secondary transition-colors duration-500 hover:text-text-primary"
                  >
                    ← Back to Organizations
                  </Link>
                </div>
                <h1 className="max-w-3xl text-4xl font-light text-text-primary md:text-[54px] md:leading-[1.05]">
                  Organization Not Found
                </h1>
                <p className="max-w-[640px] text-xl font-light text-text-secondary">
                  The organization you&apos;re looking for doesn&apos;t exist or has been removed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </article>
    );
  }

  return (
    <article className="space-y-0">
      {/* Hero Section */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden mt-[-6rem] pb-28 md:mt-[-8rem]">
        <GeometricHint variant="radial-vignette" />
        <div className="relative mx-auto max-w-container px-6 pt-28 md:px-8 md:pt-32">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="mb-4">
                <Link
                  href="/orgs"
                  className="text-sm text-text-secondary transition-colors duration-500 hover:text-text-primary"
                >
                  ← Back to Organizations
                </Link>
              </div>
              <h1 className="max-w-3xl text-4xl font-light text-text-primary md:text-[54px] md:leading-[1.05]">
                {organization.name}
              </h1>
              <p className="max-w-[640px] text-xl font-light text-text-secondary">
                Published worlds and projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Grid Section */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 bg-[#090D12] pt-36 pb-32 md:pt-44 md:pb-36">
        <div className="relative mx-auto max-w-container px-6 md:px-8">
          <ProjectsGrid projects={projects} />
        </div>
      </section>
    </article>
  );
}
