import type { Metadata } from "next";
import { getOrganizationBySlug } from "@/lib/organizations";

type Props = {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
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

export default function OrgSlugLayout({ children }: Props) {
  return <>{children}</>;
}
