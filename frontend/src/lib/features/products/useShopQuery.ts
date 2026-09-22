"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { ProductListQuery, ProductSort } from "@/lib/features/products/types";
import { PRODUCTS_PER_PAGE, SORT_OPTIONS } from "@/lib/features/products/types";

const isSort = (value: string | null): value is ProductSort =>
  SORT_OPTIONS.some((option) => option.value === value);

const toPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toMinorUnits = (value: string | null): number | undefined => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined;
};

export type ShopFilters = {
  query: ProductListQuery;
  /** Applies every key in one navigation; null removes the parameter. */
  setFilter: (overrides: Record<string, string | null>) => void;
  buildHref: (overrides: Record<string, string | null>) => string;
  reset: () => void;
  activeFilterCount: number;
};

const isLetter = (value: string | null): value is string =>
  value !== null && /^[A-Za-z]$/.test(value);

/**
 * The URL is the state. That keeps the back button, sharing a filtered link
 * and the service worker's page cache all working — none of which survive if
 * filters live in component state.
 */
export function useShopQuery(fixed: Partial<ProductListQuery> = {}): ShopFilters {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = useCallback(
    (overrides: Record<string, string | null>): string => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      // Any filter change invalidates the current page number.
      if (!("page" in overrides)) next.delete("page");

      const queryString = next.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [pathname, searchParams],
  );

  const setFilter = useCallback(
    (overrides: Record<string, string | null>) => {
      // scroll: false — changing a filter should not throw the customer back
      // to the top of a long grid.
      router.push(buildHref(overrides), { scroll: false });
    },
    [buildHref, router],
  );

  const reset = useCallback(() => router.push(pathname), [pathname, router]);

  const query = useMemo<ProductListQuery>(() => {
    const sortParam = searchParams.get("sort");
    const letterParam = searchParams.get("letter");

    return {
      page: toPositiveInt(searchParams.get("page"), 1),
      perPage: PRODUCTS_PER_PAGE,
      ...(searchParams.get("q") ? { search: searchParams.get("q") as string } : {}),
      ...(searchParams.get("category")
        ? { category: searchParams.get("category") as string }
        : {}),
      ...(searchParams.get("brand")
        ? { brand: searchParams.get("brand") as string }
        : {}),
      ...(toMinorUnits(searchParams.get("min")) !== undefined
        ? { minPrice: toMinorUnits(searchParams.get("min")) }
        : {}),
      ...(toMinorUnits(searchParams.get("max")) !== undefined
        ? { maxPrice: toMinorUnits(searchParams.get("max")) }
        : {}),
      ...(isSort(sortParam) ? { sort: sortParam } : {}),
      ...(isLetter(letterParam) ? { letter: letterParam.toUpperCase() } : {}),
      // A category or brand archive pins its own term regardless of the URL.
      ...fixed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fixed` is a literal at every call site
  }, [searchParams, fixed.category, fixed.brand, fixed.search]);

  const activeFilterCount = ["category", "brand", "min", "max", "q", "letter"].filter(
    (key) => searchParams.get(key) && !(key in fixed),
  ).length;

  return { query, setFilter, buildHref, reset, activeFilterCount };
}
