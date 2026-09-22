"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { PriceRangeSlider } from "@/components/commerce/PriceRangeSlider";
import {
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetPriceRangeQuery,
  useGetTagsQuery,
} from "@/lib/features/products/productsApi";
import { SORT_OPTIONS, type ProductSort } from "@/lib/features/products/types";
import { cn } from "@/lib/utils/cn";

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

export type ShopFiltersProps = {
  category?: string | undefined;
  brand?: string | undefined;
  sort?: ProductSort | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  letter?: string | undefined;
  activeFilterCount: number;
  /** Applies one navigation for every key passed; null removes a filter. */
  onChange: (overrides: Record<string, string | null>) => void;
  onReset: () => void;
  /** Hidden on an archive page, where the term is already fixed by the route. */
  showCategories?: boolean;
  showBrands?: boolean;
};

export function ShopFilters({
  category,
  brand,
  sort,
  minPrice,
  maxPrice,
  letter,
  activeFilterCount,
  onChange,
  onReset,
  showCategories = true,
  showBrands = true,
}: ShopFiltersProps) {
  const pathname = usePathname();
  const { data: categories = [] } = useGetCategoriesQuery(undefined, {
    skip: !showCategories,
  });
  const { data: brands = [] } = useGetBrandsQuery(undefined, { skip: !showBrands });
  const { data: priceRange } = useGetPriceRangeQuery();
  const { data: tags = [] } = useGetTagsQuery();

  // Whole cedis, like the original's slider — pesewas in a filter are noise.
  const bounds: [number, number] = [
    Math.floor((priceRange?.minMinor ?? 0) / 100),
    Math.ceil((priceRange?.maxMinor ?? 0) / 100),
  ];

  const selected: [number, number] = [
    minPrice !== undefined ? Math.floor(minPrice / 100) : bounds[0],
    maxPrice !== undefined ? Math.ceil(maxPrice / 100) : bounds[1],
  ];

  // Dragging is local state; only the release writes to the URL. Null means
  // "no drag in progress", so the handles follow the URL again after a reset.
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const handles = draft ?? selected;

  // Reset during render, not in an effect: the handles must never paint once
  // at the dragged position after the URL has already moved on.
  const priceKey = `${minPrice}|${maxPrice}|${priceRange?.minMinor}|${priceRange?.maxMinor}`;
  const [lastPriceKey, setLastPriceKey] = useState(priceKey);
  if (priceKey !== lastPriceKey) {
    setLastPriceKey(priceKey);
    setDraft(null);
  }

  // The category parameter carries a comma-separated list, so several terms
  // can be ticked at once; the API treats it as "any of these".
  const selectedCategories = category ? category.split(",").filter(Boolean) : [];

  const toggleCategory = (slug: string) => {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((value) => value !== slug)
      : [...selectedCategories, slug];

    onChange({ category: next.length > 0 ? next.join(",") : null });
  };

  // Both bounds in one navigation: two pushes in a row would both be built
  // from the same search params, and the second would drop the first.
  const commitPrice = ([low, high]: [number, number]) => {
    onChange({
      min: low > bounds[0] ? String(low) : null,
      max: high < bounds[1] ? String(high) : null,
    });
  };

  return (
    <div className="rounded-tight flex flex-col gap-6 p-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => commitPrice(handles)}
          className="focus-ring hover:bg-sand text-body rounded-full bg-black px-9.5 py-4 font-medium text-[#e3edef] transition-colors hover:text-black"
        >
          Apply
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="focus-ring border-ink hover:bg-mist text-meta rounded-full border px-8 py-4 font-semibold"
          >
            Reset
          </button>
        )}
      </div>

      <section>
        <h2 className="text-body mb-4 font-bold text-[#222222]">Price range</h2>
        {priceRange && bounds[1] > bounds[0] ? (
          <PriceRangeSlider
            min={bounds[0]}
            max={bounds[1]}
            value={handles}
            onChange={setDraft}
            onCommit={commitPrice}
          />
        ) : (
          <p className="text-sm text-neutral-500">Loading prices…</p>
        )}
      </section>

      {showCategories && (
        <section>
          <h2 className="text-body mb-4 font-bold text-[#222222]">Product categories</h2>
          <ul>
            {categories.map((term) => {
              const isChecked = selectedCategories.includes(term.slug);

              return (
                <li key={term.slug} className="mb-1 pt-1">
                  <label className="flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      onChange={() => toggleCategory(term.slug)}
                    />
                    <Decorator checked={isChecked} />
                    <span className="text-meta font-semibold text-[#424242]">
                      {term.name}
                      <span className="pl-1">({term.productCount})</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showBrands && brands.length > 0 && (
        <section>
          <h2 className="text-body mb-4 font-bold text-[#222222]">Brand</h2>
          <select
            value={brand ?? ""}
            onChange={(event) => onChange({ brand: event.target.value || null })}
            aria-label="Filter by brand"
            className="focus-ring select-control rounded-card text-meta min-h-11 w-full border border-[#7c8a73]/35 bg-white px-3 pr-10 font-semibold text-[#424242]"
          >
            <option value="">All brands</option>
            {brands.map((term) => (
              <option key={term.slug} value={term.slug}>
                {term.name} ({term.productCount})
              </option>
            ))}
          </select>
        </section>
      )}

      <section>
        <h2 className="text-body mb-4 font-bold text-[#222222]">Sort by</h2>
        <select
          value={sort ?? "latest"}
          onChange={(event) => onChange({ sort: event.target.value })}
          aria-label="Sort products"
          className="focus-ring select-control rounded-card text-meta min-h-11 w-full border border-[#7c8a73]/35 bg-white px-3 pr-10 font-semibold text-[#424242]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-tight bg-[#f5f5f5]/55 pt-3 pr-3 pb-5.5 pl-4.5">
        <h2 className="text-body mb-3 font-bold text-[#222222]">Alphabetical</h2>
        <div className="flex flex-wrap gap-2.5">
          {LETTERS.map((character) => {
            const isActive = letter === character;

            return (
              <button
                key={character}
                type="button"
                aria-pressed={isActive}
                // Pressing the selected letter again clears it, as on the original.
                onClick={() => onChange({ letter: isActive ? null : character })}
                className={cn(
                  "focus-ring rounded-pill text-meta border px-2 py-1 font-semibold",
                  isActive
                    ? "bg-olive border-olive text-white"
                    : "border-chip-line bg-chip/85 text-chip-ink",
                )}
              >
                {character}
              </button>
            );
          })}
        </div>
      </section>

      {/* The tag archives are pages, not filters, so these are links. Without
          them the only way to reach a tag would be to type its URL. The set
          comes from the API, so a tag added in the database shows up here. */}
      {tags.length > 0 && (
        <section className="rounded-tight bg-[#f5f5f5]/55 pt-3 pr-3 pb-5.5 pl-4.5">
          <h2 className="text-body mb-3 font-bold text-[#222222]">Product tags</h2>
          <ul className="flex flex-wrap gap-2.5">
            {tags.map((tag) => {
              const isActive = pathname === `/product-tag/${tag.slug}`;

              return (
                <li key={tag.slug}>
                  <Link
                    href={`/product-tag/${tag.slug}`}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "focus-ring rounded-pill text-meta inline-block border px-3 py-1 font-semibold no-underline hover:no-underline",
                      isActive
                        ? "bg-olive border-olive text-white"
                        : "border-chip-line bg-chip/85 text-chip-ink",
                    )}
                  >
                    {tag.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The round tick box: sand when empty, sage with a pale check when set. */
function Decorator({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "mt-px mr-2.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#775130]/25",
        checked ? "bg-sage" : "bg-[#e7e1d9]",
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 28 28"
        className={cn("h-3 w-3 fill-[#ebe6de]", checked ? "block" : "hidden")}
      >
        <path d="M26.109 8.844c0 .391-.156.781-.438 1.062L12.233 23.344a1.5 1.5 0 0 1-2.124 0l-7.781-7.781a1.5 1.5 0 0 1 0-2.124l2.125-2.125a1.5 1.5 0 0 1 2.124 0l4.594 4.609 10.25-10.266a1.5 1.5 0 0 1 2.124 0l2.125 2.125c.282.281.438.671.438 1.062z" />
      </svg>
    </span>
  );
}
