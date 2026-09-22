import type { MetadataRoute } from "next";

import { listAllProductSlugs, listProductTags, listTermSlugs } from "@/lib/api/server";
import { clientEnv } from "@/lib/env";

/**
 * Rebuilt hourly rather than pinned at build time: products come and go without
 * a deploy, and a sitemap that only changes when the frontend ships would
 * advertise a catalogue that no longer exists.
 */
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; frequency: Frequency }[] = [
  { path: "/", priority: 1, frequency: "daily" },
  { path: "/shop", priority: 0.9, frequency: "daily" },
  { path: "/about", priority: 0.5, frequency: "monthly" },
  { path: "/contact", priority: 0.5, frequency: "monthly" },
  { path: "/track", priority: 0.4, frequency: "monthly" },
  { path: "/privacy", priority: 0.3, frequency: "yearly" },
  { path: "/terms", priority: 0.3, frequency: "yearly" },
];

type Frequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const lastModified = new Date();

  // Sequential on purpose: this is one build-time job against our own API, and
  // firing nine catalogue pages at it in parallel only risks the rate limiter.
  const productSlugs = await listAllProductSlugs();
  const categorySlugs = await listTermSlugs("categories");
  const brandSlugs = await listTermSlugs("brands");
  const tags = await listProductTags();

  const entry = (
    path: string,
    priority: number,
    changeFrequency: Frequency,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });

  return [
    ...STATIC_ROUTES.map((route) => entry(route.path, route.priority, route.frequency)),

    // Products first among the generated entries: they are what people search
    // for, and what the old site ranked on.
    ...productSlugs.map((slug) => entry(`/product/${slug}`, 0.8, "weekly")),
    ...categorySlugs.map((slug) => entry(`/category/${slug}`, 0.7, "weekly")),
    ...brandSlugs.map((slug) => entry(`/brand/${slug}`, 0.6, "weekly")),
    ...tags.map((tag) => entry(`/product-tag/${tag.slug}`, 0.5, "weekly")),
  ];
}
