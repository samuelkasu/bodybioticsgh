"use client";

import Link from "next/link";

import { ProductGrid } from "@/components/commerce/ProductGrid";
import { ErrorState } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import { useGetWishlistQuery } from "@/lib/features/wishlist/wishlistApi";

/**
 * Renders the same grid as the shop, so a saved item behaves exactly as it does
 * everywhere else — the heart on each card is what removes it, and the add to
 * cart button still works from here.
 */
export function WishlistContents() {
  const { data, isLoading, isError, error, refetch } = useGetWishlistQuery();

  if (isError) {
    return (
      <ErrorState
        message={apiErrorMessage(error, "We could not load your saved items.")}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = data?.items ?? [];

  return (
    <>
      <ProductGrid
        products={items}
        isLoading={isLoading}
        skeletonCount={4}
        emptyTitle="Nothing saved yet"
        emptyDescription="Tap the heart on any product to keep it here for later."
      />

      {!isLoading && items.length === 0 && (
        <div className="mt-6 text-center">
          <Link
            href="/shop"
            className="focus-ring bg-ink hover:bg-cocoa rounded-card inline-flex min-h-12 items-center justify-center px-6 text-base font-medium text-white transition-colors duration-200"
          >
            Browse the shop
          </Link>
        </div>
      )}
    </>
  );
}
