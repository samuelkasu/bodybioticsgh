import { clientEnv } from "@/lib/env";
import { site } from "@/lib/site";

/**
 * The site's own origin, without a trailing slash.
 *
 * Every canonical, Open Graph URL and sitemap entry is built from this, so it
 * is worth knowing where it comes from: `NEXT_PUBLIC_SITE_URL` is inlined at
 * build time, which means the value baked into a production image can never be
 * corrected at runtime. `next.config.ts` refuses to build for production while
 * it still points at localhost.
 */
export const SITE_ORIGIN = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/** Absolute URL for a site-relative path. Canonicals must not be relative. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Self-referencing canonical.
 *
 * Archives and the shop take their filters from the query string — `?page=3`,
 * `?sort=price-asc`, `?search=…` — and every combination is a distinct URL a
 * crawler can reach. Pointing them all at the bare path keeps one version in
 * the index instead of a few thousand near-identical ones. Discovery does not
 * suffer: every product has its own entry in the sitemap and its own link from
 * the grid, so nothing depends on page 3 being crawled to be found.
 */
export function canonical(path: string): { canonical: string } {
  return { canonical: absoluteUrl(path) };
}

/**
 * Title, description, canonical and Open Graph for one page, kept in step.
 *
 * Open Graph does not inherit the page title — a page that sets only `title`
 * keeps the root layout's `og:title`, so every page shares the homepage's
 * preview text when the link is shared. Setting both in one place is what stops
 * that drifting apart again.
 */
export function pageSeo(input: { title: string; description: string; path: string }): {
  title: string;
  description: string;
  alternates: { canonical: string };
  openGraph: Record<string, unknown>;
} {
  const { title, description, path } = input;

  return {
    title,
    description,
    alternates: canonical(path),
    openGraph: {
      ...OPEN_GRAPH_DEFAULTS,
      title,
      description,
      url: absoluteUrl(path),
    },
  };
}

/**
 * BreadcrumbList mirroring the trail the page already renders. Google uses it
 * to print "Home › Shop › Cleansers" in place of a bare URL in the result.
 *
 * Only ever called with the same steps that appear on screen — structured data
 * describing a path the visitor cannot see is exactly what the guidelines call
 * out.
 */
export function breadcrumbJsonLd(
  trail: readonly { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

/** Shared Open Graph defaults; pages override title, description and url. */
export const OPEN_GRAPH_DEFAULTS = {
  siteName: site.name,
  // en_GH is not in Facebook's locale list, so the store's actual audience is
  // described with the closest one it accepts rather than a code it drops.
  locale: "en_GB",
  type: "website",
} as const;
