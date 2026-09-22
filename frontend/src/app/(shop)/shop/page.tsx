import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";
import { Suspense } from "react";

import { ProductListing } from "@/components/commerce/ProductListing";
import { ProductListingFallback } from "@/components/commerce/ProductListingFallback";
import { ShopHero } from "@/components/commerce/ShopHero";

export const metadata: Metadata = pageSeo({
  title: "Shop",
  description:
    "Browse skincare, body care and wellness products. Nationwide delivery across Ghana.",
  path: "/shop",
});

export default function ShopPage() {
  return (
    <main className="flex-1">
      <ShopHero title="All Products" />

      {/* useSearchParams needs a Suspense boundary to stay statically rendered. */}
      <Suspense fallback={<ProductListingFallback />}>
        <ProductListing />
      </Suspense>
    </main>
  );
}
