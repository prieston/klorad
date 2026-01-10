"use client";

import Link from "next/link";
import { SampleImage } from "@/components/sample-image";
import type { PublishedProject } from "@/lib/organizations";

interface ProjectsGridProps {
  projects: PublishedProject[];
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  const CardContent = (project: PublishedProject) => (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-t-[4px] bg-[#0A0F13]">
        <SampleImage
          src={project.thumbnail || "/images/samples/default.jpg"}
          alt={project.title}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 line-clamp-2 text-lg font-light text-text-primary">
          {project.title}
        </h3>
        {project.description && (
          <p className="mb-2 line-clamp-2 text-sm text-text-secondary">
            {project.description}
          </p>
        )}
        {project.publishedUrl && (
          <span className="mt-auto inline-block text-xs text-text-secondary transition-colors duration-500 group-hover:text-text-primary">
            View →
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => {
            if (project.publishedUrl && project.publishedUrl.trim() !== "") {
              return (
                <Link
                  key={project.id}
                  href={project.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col overflow-hidden rounded-[4px] border border-line-soft bg-base-bg transition-all duration-500 hover:border-white/[0.06]"
                >
                  {/* Premium gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4C7FFF]/[0.08] via-[#4C7FFF]/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative z-10">
                    {CardContent(project)}
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={project.id}
                className="group relative flex flex-col overflow-hidden rounded-[4px] border border-line-soft bg-base-bg"
              >
                {CardContent(project)}
                <div className="absolute right-2 top-2 rounded bg-text-tertiary/20 px-2 py-1 text-xs uppercase tracking-[0.1em] text-text-tertiary backdrop-blur-sm">
                  Coming Soon
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-lg font-light text-text-secondary">
            No published worlds available for this organization.
          </p>
        </div>
      )}
    </>
  );
}
