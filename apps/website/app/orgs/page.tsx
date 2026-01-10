import Link from "next/link";
import type { Metadata } from "next";
import { GeometricHint } from "@/components/geometric-hint";
import { getOrganizations } from "@/lib/organizations";

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

export default async function OrgsPage() {
  const organizations = await getOrganizations();

  return (
    <article className="space-y-0">
      {/* Hero Section */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden mt-[-6rem] pb-28 md:mt-[-8rem]">
        <GeometricHint variant="radial-vignette" />
        <div className="relative mx-auto max-w-container px-6 pt-28 md:px-8 md:pt-32">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-light text-text-primary md:text-[54px] md:leading-[1.05]">
                Organizations
              </h1>
              <p className="max-w-[640px] text-xl font-light text-text-secondary">
                Explore organizations building on Klorad.
              </p>
              <p className="max-w-[640px] text-[17px] font-light leading-[1.55] text-text-secondary tracking-[0.01em]">
                Discover published worlds and projects from organizations using our geospatial platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Organizations Grid Section */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 bg-[#090D12] pt-36 pb-32 md:pt-44 md:pb-36">
        <div className="relative mx-auto max-w-container px-6 md:px-8">
          {organizations.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/orgs/${org.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-[4px] border border-line-soft bg-base-bg transition-all duration-500 hover:border-white/[0.06]"
                >
                  {/* Premium gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4C7FFF]/[0.08] via-[#4C7FFF]/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative z-10 flex flex-1 flex-col p-6">
                    <h3 className="mb-2 text-lg font-light text-text-primary">
                      {org.name}
                    </h3>
                    <span className="mt-auto inline-block text-xs text-text-secondary transition-colors duration-500 group-hover:text-text-primary">
                      View Worlds →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <p className="text-lg font-light text-text-secondary">
                No organizations available yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
