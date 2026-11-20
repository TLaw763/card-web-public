import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/lib/card-seo";
import { listAllCardsForSitemap } from "@/lib/catalog.server";
import { cardDetailPath } from "@/lib/detail-url";

// Built on request, not at build time (CI has no card-api, and a build
// shouldn't depend on it). The card list comes from the data cache, refreshed
// daily: listing the whole catalog takes ~90 card-api requests.
export const maxDuration = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/browse`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/sets`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const cards = await listAllCardsForSitemap();
  return [
    ...pages,
    ...cards.map((card) => ({
      url: `${base}${cardDetailPath(card)}`,
      lastModified: card.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
