"use client";

import Image from "next/image";
import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import type { Product } from "@/lib/features/products/types";
import { formatMoney } from "@/lib/utils/money";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";

export type FeatureProductCardProps = {
  product: Product;
  index?: number;
};

/**
 * The carousel card used in the Featured Products band: price pill floating at
 * the top-left, serif product name, and a pair of actions — "Add to cart" next
 * to a muted "Info" that opens the product page.
 */
export function FeatureProductCard({ product, index = 99 }: FeatureProductCardProps) {
  return (
    <article className="card-hover group rounded-pill flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
      <div className="relative aspect-square">
        <span className="text-ink absolute top-4 left-4 z-10 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium">
          {formatMoney(product.priceMinor, product.currency)}
        </span>

        <Link
          href={`/product/${product.slug}`}
          aria-hidden="true"
          tabIndex={-1}
          className="focus-ring block h-full w-full"
        >
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes="300px"
            loading={index < 2 ? undefined : "lazy"}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-contain p-6 transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        <h3 className="font-display text-xl leading-tight">
          <Link
            href={`/product/${product.slug}`}
            className="focus-ring no-underline hover:no-underline"
          >
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>

        <div className="mt-auto flex items-center gap-2">
          <AddToCartButton product={product} size="md" uppercase={false} />

          <Link
            href={`/product/${product.slug}`}
            className="focus-ring text-taupe-soft hover:text-ink rounded-card inline-flex min-h-12 items-center bg-neutral-100 px-5 text-sm font-medium transition-colors hover:no-underline"
          >
            Info
          </Link>
        </div>
      </div>
    </article>
  );
}
