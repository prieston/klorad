"use client";

import Link from "next/link";
import { SampleImage } from "@/components/sample-image";
import type { PublishedProject } from "@/lib/organizations";

function CardBody({ project }: { project: PublishedProject }) {
  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
        <SampleImage
          src={project.thumbnail || "/images/samples/default.jpg"}
          alt={project.title}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-medium text-text-primary">
          {project.title}
        </h3>
        {project.description && (
          <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
            {project.description}
          </p>
        )}
        {project.publishedUrl && (
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-text-secondary transition-colors group-hover:text-text-primary">
            View →
          </span>
        )}
      </div>
    </>
  );
}

export function ProjectsGrid({ projects }: { projects: PublishedProject[] }) {
  if (projects.length === 0) {
    return (
      <p className="py-24 text-center text-text-secondary">
        No published worlds available for this organization.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) =>
        project.publishedUrl && project.publishedUrl.trim() !== "" ? (
          <Link
            key={project.id}
            href={project.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group glass-panel flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-accent"
          >
            <CardBody project={project} />
          </Link>
        ) : (
          <div
            key={project.id}
            className="group glass-panel relative flex flex-col overflow-hidden rounded-2xl"
          >
            <CardBody project={project} />
            <div className="absolute right-3 top-3 rounded-full bg-glass px-2.5 py-1 text-xs uppercase tracking-[0.1em] text-text-tertiary backdrop-blur">
              Coming soon
            </div>
          </div>
        ),
      )}
    </div>
  );
}
