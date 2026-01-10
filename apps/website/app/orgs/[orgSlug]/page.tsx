import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GeometricHint } from "@/components/geometric-hint";
import { ProjectsGrid } from "@/components/projects-grid";
import { getOrganizationBySlug, getPublishedProjectsByOrg } from "@/lib/organizations";

type Props = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);

  if (!organization) {
    return {
      title: "Organization Not Found | Klorad",
    };
  }

  return {
    title: `${organization.name} | Organizations | Klorad`,
    description: `Explore published worlds and projects from ${organization.name} on Klorad's geospatial platform.`,
    openGraph: {
      title: `${organization.name} | Klorad`,
      description: `Explore published worlds from ${organization.name}.`,
    },
    alternates: {
      canonical: `/orgs/${orgSlug}`,
    },
  };
}

export default async function OrgSlugPage({ params }: Props) {
  const { orgSlug } = await params;
  const organization = await getOrganizationBySlug(orgSlug);

  if (!organization) {
    notFound();
  }

  const projects = await getPublishedProjectsByOrg(organization.id);

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
