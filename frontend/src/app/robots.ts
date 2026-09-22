import type { MetadataRoute } from "next";

import { clientEnv } from "@/lib/env";

/**
 * Crawlers get the catalogue and nothing else. The disallowed paths are not
 * secret — they are protected server-side — but a crawler following a cart or
 * checkout link burns budget on pages that can never rank, and an indexed
 * `/order/BB-…` in someone's search results would be an embarrassment.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account/", "/cart", "/checkout", "/order/", "/offline"],
    },
    sitemap: `${clientEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
