import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";

/**
 * The cart page is a Client Component — it reads the cart query — and a Client
 * Component cannot export metadata. Without this layout /cart has no
 * description of its own, which is most of what costs it its SEO score.
 */
export const metadata: Metadata = pageSeo({
  title: "Your cart",
  description:
    "Review the items in your Body Biotics GH cart, apply a coupon and see what delivery costs before you check out.",
  path: "/cart",
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
