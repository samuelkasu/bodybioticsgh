import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { PriceTag } from "@/components/commerce/PriceTag";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import type { Product } from "@/lib/features/products/types";
import { optimizedImageUrl } from "@/lib/utils/imageLoader";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";

export type ProductCardProps = {
  product: Product;
  /**
   * Only the first row of the first screen should block paint; everything else
   * is lazy. Passing an index keeps that decision in one place.
   */
  index?: number;
};

/**
 * White image panel over a sand body with centred name, price and an olive
 * button — the card shape the original storefront uses. A product that is out
 * of stock gets "Read more" through to its page instead of a dead button,
 * again matching the original.
 */
export function ProductCard({ product, index = 99 }: ProductCardProps) {
  return (
    // photo-swap on the whole card, not just the photo: hovering anywhere on
    // the card swaps the image, which is what the original does.
    <article className="border-card-line/90 bg-card photo-swap card-hover group rounded-card relative flex h-full flex-col overflow-hidden border">
      {/* Above the photo link so the whole card stays one link for a screen
          reader while the save toggle keeps its own name. */}
      <WishlistButton product={product} />

      {/* Top-left, diagonally opposite the save toggle so the two never
          collide on a narrow card. The API returns a percent only while an
          offer is actually running, whether that is this product's own sale
          price or a campaign across the shop. */}
      {product.discountPercent !== null && product.discountPercent > 0 && (
        <p className="bg-olive text-caption tracking-label absolute top-2 left-2 z-10 rounded-full px-2.5 py-1 font-semibold text-white uppercase shadow-sm">
          <span className="sr-only">Save </span>
          {product.discountPercent}% off
        </p>
      )}
      {/*
        Decorative duplicate of the title link: hidden from assistive tech and
        skipped by the keyboard, so the card exposes one link, not two with the
        same name.
      */}
      <Link
        href={`/product/${product.slug}`}
        aria-hidden="true"
        tabIndex={-1}
        className="focus-ring relative block aspect-square bg-white"
      >
        <Image
          src={product.imageUrl}
          alt=""
          fill
          // Two-up on a phone, four-up on a desktop: tells the optimizer to
          // ship a ~200px file to a phone rather than a 1200px one.
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={index < 2}
          loading={index < 2 ? undefined : "lazy"}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/*
          The second gallery photo, as the original's cards cross-fade to.

          A background rather than an <img>: a phone has no hover, so it can
          never see this photo, but an <img> would still be fetched — 300KB of
          a 1.26MB shop page on a device that cannot use a byte of it. The
          background lives behind `@media (hover: hover)` in globals.css, which
          a touch browser never resolves, and the URL still goes through the
          image optimizer.
        */}
        {product.hoverImageUrl && (
          <span
            aria-hidden="true"
            className="photo-swap-back absolute inset-0 bg-cover bg-center transition-opacity duration-300"
            style={
              {
                "--hover-photo": `url("${optimizedImageUrl(product.hoverImageUrl, 640)}")`,
              } as CSSProperties
            }
          />
        )}
      </Link>

      <div className="product-card-body flex flex-1 flex-col px-0 text-left sm:text-center">
        <h3 className="text-body tracking-label sm:text-body mt-2 mb-4 px-2.5 font-sans text-black">
          {/* No rule under the name: the whole card is the hit area, and the
              photo already swaps to show it is live. */}
          <Link
            href={`/product/${product.slug}`}
            className="focus-ring no-underline hover:no-underline"
          >
            {/* Two lines maximum keeps every card in a row the same height. */}
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>

        <div className="mt-auto">
          {/* The block box lives here rather than on PriceTag: the tag itself
              switches between an inline value and a flex row once there is a
              "was" price to sit beside, and a `block` passed in from outside
              would fight that. */}
          <div className="mb-px px-2.5">
            <PriceTag
              amountMinor={product.priceMinor}
              compareAtMinor={product.compareAtPriceMinor}
              currency={product.currency}
              size="card"
              className="text-[#4f4f4f]"
            />
          </div>

          {/* Said on the card, not discovered after a tap. "Read more" is the
              only thing that marked a sold-out product before, which reads as
              an invitation rather than a refusal. */}
          {!product.inStock ? (
            <p className="text-caption tracking-label px-2.5 font-medium text-[#d9534f] uppercase">
              Out of stock
            </p>
          ) : (
            product.lowStockRemaining !== null && (
              <p className="text-caption tracking-label px-2.5 font-medium text-[#b45309]">
                Only {product.lowStockRemaining} left
              </p>
            )
          )}

          <div className="mt-2 mb-5 px-2.5">
            {product.inStock ? (
              <AddToCartButton
                product={product}
                size="sm"
                variant="olive"
                // Two cards fit a 320px screen, so the label has to hold one
                // line inside ~145px.
                className="text-caption sm:text-meta px-3 whitespace-nowrap sm:px-5"
              />
            ) : (
              <Link
                href={`/product/${product.slug}`}
                className="focus-ring bg-olive hover:bg-cocoa rounded-card text-caption tracking-label sm:text-meta inline-flex min-h-11 items-center justify-center px-3 font-semibold whitespace-nowrap text-white uppercase no-underline transition-colors hover:no-underline sm:px-5"
              >
                Read more
                {/*
                  In the markup rather than an aria-label: an aria-label names
                  the link for a screen reader but leaves the crawlable anchor
                  text as the bare "Read more", which is what Google reads and
                  what Lighthouse flags. This way both see the product name,
                  and the button still reads "Read more" on screen.
                */}
                <span className="sr-only"> about {product.name}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
