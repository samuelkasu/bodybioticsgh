"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProductGrid } from "@/components/commerce/ProductGrid";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ErrorState } from "@/components/ui/Feedback";
import { SearchIcon } from "@/components/ui/Icons";
import { apiErrorMessage } from "@/lib/api/http";
import { useGetProductsQuery } from "@/lib/features/products/productsApi";
import type { ProductSort } from "@/lib/features/products/types";
import { cn } from "@/lib/utils/cn";

export type FeaturedProductsProps = {
  title: string;
  eyebrow?: string;
  sort?: ProductSort;
  limit?: number;
  /** The "Shop by latest" block carries the catalogue search field. */
  withSearch?: boolean;
  tone?: "cream" | "creamDeep";
};

export function FeaturedProducts({
  title,
  eyebrow,
  sort = "latest",
  limit = 8,
  withSearch = false,
  tone = "cream",
}: FeaturedProductsProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Always the full `limit`, even on a slow link. The skeleton reserves
  // `limit` cards before the connection is known, so halving the rows made
  // three rows collapse when the products landed and shoved the whole page up
  // (CLS 0.88 on mobile). The saving was a few KB of JSON anyway: every card
  // past the second lazy-loads its image, so the lower rows cost nothing on a
  // slow link until someone scrolls to them.
  const { data, isLoading, isError, error, refetch } = useGetProductsQuery({
    perPage: limit,
    sort,
  });

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = search.trim();
    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
  };

  return (
    <section
      aria-labelledby={`featured-${sort}`}
      className={cn(
        "defer-paint px-4 py-14 sm:px-6 lg:py-20",
        tone === "cream" ? "bg-cream" : "bg-cream-deep",
      )}
    >
      <div className="mx-auto w-full max-w-7xl">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          {/* min-w-0 so a long heading wraps instead of widening the page. */}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2
              id={`featured-${sort}`}
              className="mt-3 max-w-xl text-3xl leading-[1.15] sm:text-4xl lg:text-5xl"
            >
              {title}
            </h2>
          </div>

          <Link href="/shop" className="focus-ring">
            <Button size="lg">See All Latest</Button>
          </Link>
        </Reveal>

        {withSearch && (
          <form
            role="search"
            onSubmit={onSearch}
            className="border-sand rounded-card mt-8 flex items-center gap-3 border bg-white/70 px-5 py-1"
          >
            <SearchIcon className="text-taupe-soft h-5 w-5 shrink-0" />
            <label className="sr-only" htmlFor="catalogue-search">
              Search products
            </label>
            <input
              id="catalogue-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Products..."
              // min-w-0 defeats the input's default intrinsic width, which is
              // wider than a phone and pushes the whole page sideways.
              className="focus-ring h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#8D8075]"
            />
            {/* Submits on Enter; the original had no button inside the field. */}
            <button type="submit" className="sr-only">
              Search
            </button>
          </form>
        )}

        <div className="mt-8">
          {isError ? (
            <ErrorState
              message={apiErrorMessage(error, "We could not load the catalogue.")}
              onRetry={() => void refetch()}
            />
          ) : (
            <ProductGrid
              products={data?.items ?? []}
              isLoading={isLoading}
              skeletonCount={limit}
            />
          )}
        </div>
      </div>
    </section>
  );
}
