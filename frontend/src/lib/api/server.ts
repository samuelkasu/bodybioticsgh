import { cache } from "react";

import type { ApiSuccess } from "@/lib/api/http";
import { serverEnv } from "@/lib/env";
import type {
  Paginated,
  Product,
  ProductDetail,
  ProductTag,
  TermSummary,
} from "@/lib/features/products/types";

/**
 * Reading the catalogue from a Server Component. The browser goes through the
 * Next proxy so the session cookie stays first-party; the server has no such
 * constraint and calls the API origin directly, saving a hop.
 *
 * This exists for the things RTK Query cannot do: page metadata, JSON-LD and
 * the sitemap all have to be resolved before the HTML is sent. Interactive
 * fetching stays in the client components.
 */

/** Catalogue copy changes rarely; a stale title for five minutes is harmless. */
const CATALOGUE_REVALIDATE = 300;

/** The API caps perPage at 48 (ProductListRequestValidator). */
const MAX_PER_PAGE = 48;

/** Guards against an unbounded loop if the API ever reports a nonsense total. */
const MAX_SITEMAP_PAGES = 40;

/**
 * Returns null for 404 — a missing slug is a normal answer, and the caller
 * turns it into notFound(). Any other failure throws: silently treating a 500
 * as "no such product" would de-index the catalogue the first time the API
 * hiccups during a crawl.
 */
async function getFromApi<T>(path: string): Promise<T | null> {
  const response = await fetch(`${serverEnv().API_ORIGIN}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: CATALOGUE_REVALIDATE },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}

/**
 * `cache` dedupes within a single render pass, so generateMetadata and the page
 * body asking for the same product costs one request, not two.
 */
export const getProductDetail = cache((slug: string): Promise<ProductDetail | null> =>
  getFromApi<ProductDetail>(`/api/products/${encodeURIComponent(slug)}`),
);

export const getCategory = cache((slug: string): Promise<TermSummary | null> =>
  getFromApi<TermSummary>(`/api/categories/${encodeURIComponent(slug)}`),
);

export const getBrand = cache((slug: string): Promise<TermSummary | null> =>
  getFromApi<TermSummary>(`/api/brands/${encodeURIComponent(slug)}`),
);

export const getProductTag = cache((slug: string): Promise<ProductTag | null> =>
  getFromApi<ProductTag>(`/api/tags/${encodeURIComponent(slug)}`),
);

/**
 * Everything below is for the sitemap, which is generated at build time — and
 * the frontend build runs in CI with no API and no database. So these degrade
 * to an empty list rather than failing the build: a sitemap listing only the
 * static routes is recoverable, a red build is not.
 */
async function forSitemap<T>(path: string, describe: string): Promise<T | null> {
  try {
    return await getFromApi<T>(path);
  } catch (error) {
    console.warn(`Sitemap: could not read ${describe} (${String(error)})`);
    return null;
  }
}

export async function listAllProductSlugs(): Promise<string[]> {
  const slugs: string[] = [];

  for (let page = 1; page <= MAX_SITEMAP_PAGES; page += 1) {
    const result = await forSitemap<Paginated<Product>>(
      `/api/products?page=${page}&perPage=${MAX_PER_PAGE}`,
      "the product list",
    );

    if (!result) break;

    slugs.push(...result.items.map((product) => product.slug));

    if (slugs.length >= result.total || result.items.length === 0) break;
  }

  return slugs;
}

export async function listTermSlugs(kind: "categories" | "brands"): Promise<string[]> {
  const terms = await forSitemap<TermSummary[]>(`/api/${kind}`, kind);

  return terms?.map((term) => term.slug) ?? [];
}

/**
 * Also used by the tag archive's generateStaticParams, which runs in the same
 * API-less build — an empty list there means the pages render on demand rather
 * than at build time, not that the tags are gone.
 */
export async function listProductTags(): Promise<ProductTag[]> {
  return (await forSitemap<ProductTag[]>("/api/tags", "product tags")) ?? [];
}
