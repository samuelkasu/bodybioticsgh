"use client";

import { useState } from "react";

import { Pagination } from "@/components/commerce/Pagination";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { ShopFilterDrawer } from "@/components/commerce/ShopFilterDrawer";
import { ShopFilters } from "@/components/commerce/ShopFilters";
import { ShopSearch } from "@/components/commerce/ShopSearch";
import { ErrorState } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import {
  useGetProductsQuery,
  useLazyGetProductsQuery,
} from "@/lib/features/products/productsApi";
import { useShopQuery } from "@/lib/features/products/useShopQuery";
import type { Product } from "@/lib/features/products/types";
import { PRODUCTS_PER_PAGE, pageCount } from "@/lib/features/products/types";

export type ProductListingProps = {
  /** Pins the archive's term; the matching filter control is then hidden. */
  fixedCategory?: string;
  /** One slug, or several comma-separated — a tag archive spans brands. */
  fixedBrand?: string;
  /** Pins a search term, for archives defined by a word rather than a term. */
  fixedSearch?: string;
};

/**
 * Shared by /shop, /category/[slug], /brand/[slug] and /product-tag/[slug]: the
 * only difference between those pages is which term is pinned. Filters sit in a
 * sidebar on a desktop and behind a "Filter & sort" disclosure on a phone, as
 * on the original storefront.
 */
export function ProductListing({
  fixedCategory,
  fixedBrand,
  fixedSearch,
}: ProductListingProps) {
  const { query, setFilter, buildHref, reset, activeFilterCount } = useShopQuery({
    ...(fixedCategory ? { category: fixedCategory } : {}),
    ...(fixedBrand ? { brand: fixedBrand } : {}),
    ...(fixedSearch ? { search: fixedSearch } : {}),
  });

  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetProductsQuery(query);

  const total = data?.total ?? 0;
  const page = data?.page ?? query.page ?? 1;
  const totalPages = pageCount(total, data?.perPage ?? PRODUCTS_PER_PAGE);

  const [filtersOpen, setFiltersOpen] = useState(false);

  // "Load More" appends pages under the one the URL points at. Everything
  // appended is dropped as soon as the filters or the page change, otherwise
  // the grid would show results from a query the customer has left behind.
  const [appended, setAppended] = useState<Product[]>([]);
  const [lastLoaded, setLastLoaded] = useState(page);
  const [loadMore, { isFetching: isLoadingMore }] = useLazyGetProductsQuery();
  const queryKey = JSON.stringify(query);
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);

  // Reset during render rather than in an effect, so the grid never paints one
  // frame of the previous query's appended pages.
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setAppended([]);
    setLastLoaded(query.page ?? 1);
  }

  const onLoadMore = async () => {
    const next = lastLoaded + 1;
    if (next > totalPages) return;

    try {
      const result = await loadMore({ ...query, page: next }).unwrap();
      setAppended((previous) => [...previous, ...result.items]);
      setLastLoaded(next);
    } catch {
      // The error state below already covers a dead connection; a failed
      // "load more" simply leaves the grid as it was.
    }
  };

  const products = [...(data?.items ?? []), ...appended];

  return (
    <section className="bg-panel">
      <div className="max-w-shell mx-auto w-full px-4 pt-8 pb-14 lg:flex lg:items-start lg:gap-5">
        <aside className="hidden shrink-0 lg:block lg:w-1/4">
          <ShopFilters
            {...(query.category !== undefined ? { category: query.category } : {})}
            {...(query.brand !== undefined ? { brand: query.brand } : {})}
            {...(query.sort !== undefined ? { sort: query.sort } : {})}
            {...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {})}
            {...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {})}
            {...(query.letter !== undefined ? { letter: query.letter } : {})}
            activeFilterCount={activeFilterCount}
            onChange={setFilter}
            onReset={reset}
            showCategories={!fixedCategory}
            showBrands={!fixedBrand}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="shop-filters"
              className="focus-ring hover:bg-mist rounded-tight text-body inline-flex items-center gap-2 border border-[#d2c6bb] bg-[#eae4dd]/70 px-3 py-2.5 font-medium text-black"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-current"
              >
                <path d="M1.5,6.227H3.925c.199,2.411,1.861,2.704,3.132,2.704s2.932-.293,3.132-2.704h12.312c.276,0,.5-.224,.5-.5s-.224-.5-.5-.5H10.188c-.199-2.411-1.861-2.704-3.132-2.704s-2.932,.293-3.132,2.704H1.5c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5ZM7.056,3.523c1.362,0,2.151,.36,2.151,2.204s-.789,2.204-2.151,2.204-2.151-.36-2.151-2.204,.789-2.204,2.151-2.204Z" />
                <path d="M22.5,11.5h-2.425c-.199-2.411-1.861-2.704-3.132-2.704s-2.932,.293-3.132,2.704H1.5c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5H13.812c.199,2.411,1.861,2.704,3.132,2.704s2.932-.293,3.132-2.704h2.425c.276,0,.5-.224,.5-.5s-.224-.5-.5-.5Zm-5.556,2.704c-1.362,0-2.151-.36-2.151-2.204s.789-2.204,2.151-2.204,2.151,.36,2.151,2.204-.789,2.204-2.151,2.204Z" />
                <path d="M22.5,17.773H10.188c-.199-2.411-1.861-2.704-3.132-2.704s-2.932,.293-3.132,2.704H1.5c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5H3.925c.199,2.41,1.862,2.703,3.132,2.703s2.932-.293,3.132-2.703h12.312c.276,0,.5-.224,.5-.5s-.224-.5-.5-.5Zm-15.444,2.703c-1.362,0-2.151-.36-2.151-2.203s.789-2.204,2.151-2.204,2.151,.36,2.151,2.204-.789,2.203-2.151,2.203Z" />
              </svg>
              FILTER &amp; SORT
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>

          <ShopFilterDrawer isOpen={filtersOpen} onClose={() => setFiltersOpen(false)}>
            <div id="shop-filters">
              <ShopFilters
                {...(query.category !== undefined ? { category: query.category } : {})}
                {...(query.brand !== undefined ? { brand: query.brand } : {})}
                {...(query.sort !== undefined ? { sort: query.sort } : {})}
                {...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {})}
                {...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {})}
                {...(query.letter !== undefined ? { letter: query.letter } : {})}
                activeFilterCount={activeFilterCount}
                onChange={setFilter}
                onReset={reset}
                showCategories={!fixedCategory}
                showBrands={!fixedBrand}
              />
            </div>
          </ShopFilterDrawer>

          {/* Hidden where the archive itself is a search: typing would look
              like it worked while the pinned term still decided the results. */}
          {!fixedSearch && (
            <ShopSearch
              value={query.search ?? ""}
              onChange={(value) => setFilter({ q: value })}
            />
          )}

          {/* Rendered while loading too, empty. The count used to appear only
              once results landed, which inserted a line of text above the grid
              and shifted everything under it — including the footer. Holding
              the box open costs nothing and keeps the announcement. */}
          {!isError && (
            <p aria-live="polite" className="mb-3 min-h-5 text-sm text-neutral-600">
              {isLoading
                ? ""
                : total === 0
                  ? "No products found"
                  : `Showing ${products.length} of ${total} product${total === 1 ? "" : "s"}`}
            </p>
          )}

          {isError ? (
            <ErrorState
              message={apiErrorMessage(error, "We could not load the catalogue.")}
              onRetry={() => void refetch()}
            />
          ) : (
            <div
              className={
                isFetching && !isLoading ? "opacity-60 transition-opacity" : undefined
              }
            >
              <ProductGrid
                products={products}
                isLoading={isLoading}
                skeletonCount={PRODUCTS_PER_PAGE}
                emptyDescription={
                  activeFilterCount > 0
                    ? "Try clearing a filter or searching for something else."
                    : "Check back soon — new stock arrives weekly."
                }
              />
            </div>
          )}

          <div className={isLoading ? "product-pager-hold" : undefined}>
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(next) => buildHref({ page: String(next) })}
              onLoadMore={lastLoaded < totalPages ? () => void onLoadMore() : undefined}
              isLoadingMore={isLoadingMore}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
