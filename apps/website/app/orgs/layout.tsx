import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organizations | Klorad",
  description:
    "Browse all organizations on Klorad's geospatial platform. Explore published worlds and projects from different organizations.",
  openGraph: {
    title: "Organizations | Klorad",
    description:
      "Browse all organizations on Klorad's geospatial platform.",
  },
  alternates: {
    canonical: "/orgs",
  },
};

export default function OrgsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
