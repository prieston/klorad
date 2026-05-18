import { MetadataRoute } from "next";
import { journalPosts } from "@/lib/journalPosts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://klorad.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const journalEntries: MetadataRoute.Sitemap = journalPosts.map((post) => ({
    url: `${siteUrl}/journal/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/platform`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...["campus", "mobility", "virtual-heritage", "urban"].map((slug) => ({
      url: `${siteUrl}/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    {
      url: `${siteUrl}/research`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/samples`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/partners`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/journal`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  return [...staticPages, ...journalEntries];
}

