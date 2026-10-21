import type { MetadataRoute } from "next";
import { publishedCategories, games, site } from "@/lib/catalog";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;

  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/games/`,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    ...publishedCategories.map((category) => ({
      url: `${base}/category/${category.slug}/`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...games.map((game) => ({
      url: `${base}/games/${game.slug}/`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    {
      url: `${base}/favorites/`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/scorecard/`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
