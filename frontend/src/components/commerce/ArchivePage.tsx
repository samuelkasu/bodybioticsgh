"use client";

import Link from "next/link";
import { Suspense } from "react";

import { ProductListing } from "@/components/commerce/ProductListing";
import { ProductListingFallback } from "@/components/commerce/ProductListingFallback";
import { ShopHero } from "@/components/commerce/ShopHero";
import { ErrorState } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import {
  useGetBrandQuery,
  useGetCategoryQuery,
} from "@/lib/features/products/productsApi";

export type ArchivePageProps = {
  slug: string;
  kind: "category" | "brand";
};

/**
 * Category and brand archives differ only in which endpoint names the term, so
 * they share one component and one product listing.
 */
export function ArchivePage({ slug, kind }: ArchivePageProps) {
  const category = useGetCategoryQuery(slug, { skip: kind !== "category" });
  const brand = useGetBrandQuery(slug, { skip: kind !== "brand" });
  const term = kind === "category" ? category : brand;

  if (term.isError) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <ErrorState
          title={`We could not find that ${kind}`}
          message={apiErrorMessage(term.error, "It may have been renamed or removed.")}
        />
        <p className="mt-4 text-center text-sm">
          <Link href="/shop" className="focus-ring underline">
            Browse all products
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <ShopHero
        eyebrow={kind === "category" ? "shop by category" : "shop by brand"}
        title={term.data?.name ?? slug}
      />

      <div className="bg-panel">
        <nav
          aria-label="Breadcrumb"
          className="max-w-shell mx-auto w-full px-4 pt-6 text-sm text-neutral-600"
        >
          <Link href="/" className="focus-ring hover:underline">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/shop" className="focus-ring hover:underline">
            Shop
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{term.data?.name ?? slug}</span>
        </nav>
      </div>

      <Suspense fallback={<ProductListingFallback />}>
        {kind === "category" ? (
          <ProductListing fixedCategory={slug} />
        ) : (
          <ProductListing fixedBrand={slug} />
        )}
      </Suspense>
    </main>
  );
}
