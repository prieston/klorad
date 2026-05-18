"use client";

import Link from "next/link";
import useSWR from "swr";
import { organizationsFetcher } from "@/lib/api";
import { Eyebrow } from "@/components/ui";

export default function OrgsPage() {
  const {
    data: organizations = [],
    isLoading,
    error,
  } = useSWR("/api/orgs", organizationsFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 0,
  });

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 grid-field" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[600px] w-[600px] rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative z-10 mx-auto max-w-container px-6 py-24 md:px-8 md:py-32">
          <div className="max-w-2xl animate-fade-up">
            <Eyebrow>Organizations</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              Organizations on Klorad.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              Discover published worlds and projects from organizations building
              on the platform.
            </p>
          </div>
        </div>
      </section>

      {/* ── Grid ───────────────────────────────────────────── */}
      <section className="border-t border-line-soft py-20 md:py-28">
        <div className="mx-auto max-w-container px-6 md:px-8">
          {isLoading ? (
            <p className="py-20 text-center text-text-secondary">
              Loading organizations…
            </p>
          ) : error ? (
            <p className="py-20 text-center text-text-secondary">
              Could not load organizations. Please try again later.
            </p>
          ) : organizations.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/orgs/${org.slug}`}
                  className="group glass-panel flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent"
                >
                  <h3 className="text-lg font-medium text-text-primary">
                    {org.name}
                  </h3>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
                    View worlds →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-20 text-center text-text-secondary">
              No organizations published yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
