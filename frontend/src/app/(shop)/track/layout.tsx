import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";

/**
 * The page itself is a Client Component — it holds the reference input — and a
 * Client Component cannot export metadata. Without this layout /track inherits
 * the root title, so a page the sitemap advertises would compete with the
 * homepage under the same title in search results.
 */
export const metadata: Metadata = pageSeo({
  title: "Track your order",
  description:
    "Enter your Body Biotics GH order reference to see its status, items and delivery details.",
  path: "/track",
});

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
