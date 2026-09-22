import { ProductGrid } from "@/components/commerce/ProductGrid";
import { Skeleton } from "@/components/ui/Feedback";
import { PRODUCTS_PER_PAGE } from "@/lib/features/products/types";

/**
 * The Suspense fallback for <ProductListing>, shaped like the thing it stands
 * in for.
 *
 * `useShopQuery` reads `useSearchParams`, so the listing is client-only and the
 * server sends this instead. It used to be a single `h-96` block: 384px where
 * the listing then rendered ~4900px, so the moment React hydrated, the footer
 * shot 4400px down the page. That one substitution was the whole of /shop's
 * 0.19 CLS.
 *
 * It mirrors the listing's own loading state — same shell, same filter rail,
 * same `PRODUCTS_PER_PAGE` skeleton cards — so the height the server sends,
 * the height after hydration and the height once results arrive are all the
 * same. It does not need to be pixel-exact, only close enough that nothing
 * below it moves.
 */
export function ProductListingFallback() {
  return (
    <section className="bg-panel">
      <div className="max-w-shell mx-auto w-full px-4 pt-8 pb-14 lg:flex lg:items-start lg:gap-5">
        <aside className="hidden shrink-0 lg:block lg:w-1/4">
          <Skeleton className="h-[42rem]" />
        </aside>

        <div className="min-w-0 flex-1">
          {/* "Filter & sort", phone only. */}
          <div className="mb-4 flex justify-end lg:hidden">
            <Skeleton className="rounded-tight h-[46px] w-44" />
          </div>

          {/* The search field. */}
          <Skeleton className="rounded-card mb-5 h-[58px] w-full" />

          {/* The results count, which the listing also holds open while loading. */}
          <div className="mb-3 min-h-5" />

          <ProductGrid products={[]} isLoading skeletonCount={PRODUCTS_PER_PAGE} />

          {/* The pager the listing will render once it knows the page count. */}
          <div className="product-pager-hold" />
        </div>
      </div>
    </section>
  );
}
