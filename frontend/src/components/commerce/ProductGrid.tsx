import { ProductCard } from "@/components/commerce/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { EmptySearchArt } from "@/components/ui/EmptySearchArt";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import type { Product } from "@/lib/features/products/types";

export type ProductGridProps = {
  products: Product[];
  isLoading?: boolean;
  /** Skeleton count while loading; match the perPage in use to avoid a jump. */
  skeletonCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * The card's own shape, greyed out — not a ratio that approximates it.
 *
 * A single `aspect-[3/4]` block stood about 90px short of a real card on a
 * phone, so every row of the grid grew when the results landed and pushed the
 * whole page down: 0.17 of the shop's 0.19 CLS came from this one substitution.
 * Mirroring the card's boxes — square photo, two lines of name, price, button —
 * means the grid occupies the same height before and after. The last 16px of
 * the mismatch was a real card's optional stock caption, which no skeleton can
 * predict; both sides now share `.product-card-body` and match by construction.
 */
function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="border-card-line/90 bg-card rounded-card flex h-full flex-col overflow-hidden border"
    >
      <Skeleton className="aspect-square rounded-none" />
      <div className="product-card-body flex flex-1 flex-col px-2.5">
        {/* Two lines of product name, at the card's line height. */}
        <Skeleton className="mt-2 h-[1.4rem] w-full" />
        <Skeleton className="mt-1 mb-4 h-[1.4rem] w-3/4" />
        <div className="mt-auto">
          <Skeleton className="h-6 w-20 sm:mx-auto" />
          <Skeleton className="rounded-card mt-2 mb-5 h-11 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  isLoading = false,
  skeletonCount = 8,
  emptyTitle = "No products found",
  emptyDescription = "Try a different category or search term.",
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading products"
        className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        art={<EmptySearchArt className="h-40 w-auto sm:h-48" />}
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <Reveal
          as="li"
          key={product.id}
          delay={Math.min(index, 7) * 60}
          className="h-full"
        >
          <ProductCard product={product} index={index} />
        </Reveal>
      ))}
    </ul>
  );
}
