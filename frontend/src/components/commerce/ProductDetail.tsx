"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { FeatureProductCard } from "@/components/commerce/FeatureProductCard";
import { ProductReviews } from "@/components/commerce/ProductReviews";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { StarRating } from "@/components/commerce/StarRating";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { Reveal } from "@/components/ui/Reveal";
import { apiErrorMessage } from "@/lib/api/http";
import { useGetProductBySlugQuery } from "@/lib/features/products/productsApi";
import { useGetReviewsQuery } from "@/lib/features/reviews/reviewsApi";
import { site } from "@/lib/site";
import { formatMoney } from "@/lib/utils/money";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";

const CARD = "rounded-card bg-white";

export function ProductDetail({ slug }: { slug: string }) {
  const { data, isLoading, isError, error, refetch } = useGetProductBySlugQuery(slug);
  const { data: reviews } = useGetReviewsQuery(slug);
  const [quantity, setQuantity] = useState(1);
  const [active, setActive] = useState(0);

  // Drives the phone-only buy bar: it appears once the real Add to cart has
  // scrolled past. Reviews and related products are long, and a customer who
  // reads to the bottom should not have to scroll back up to buy.
  const buyRef = useRef<HTMLDivElement>(null);
  const [buyVisible, setBuyVisible] = useState(true);

  useEffect(() => {
    const node = buyRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setBuyVisible(entry?.isIntersecting ?? true),
      { threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
    // Re-observes once the product resolves and the button actually exists.
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="rounded-card aspect-square w-full" />
        <div className={`${CARD} space-y-4 p-6 lg:p-10`}>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${CARD} p-6 lg:p-10`}>
        <ErrorState
          title="We could not find that product"
          message={apiErrorMessage(error, "It may have sold out or been renamed.")}
          onRetry={() => void refetch()}
        />
        <p className="mt-4 text-center text-sm">
          <Link href="/shop" className="focus-ring underline">
            Browse all products
          </Link>
        </p>
      </div>
    );
  }

  const { product, images, related } = data;
  // The importer writes main first, then the narrower renditions; fall back to
  // the card photo when a product only has the one.
  const gallery =
    images.length > 0 ? images.map((image) => image.url) : [product.imageUrl];
  const index = Math.min(active, gallery.length - 1);
  const step = (direction: 1 | -1) =>
    setActive((current) => (current + direction + gallery.length) % gallery.length);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#707070]">
        <Link href="/" className="focus-ring hover:text-ink hover:underline">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/shop" className="focus-ring hover:text-ink hover:underline">
          Shop
        </Link>
        {product.categorySlug && product.categoryName && (
          <>
            <span aria-hidden="true"> / </span>
            <Link
              href={`/category/${product.categorySlug}`}
              className="focus-ring hover:text-ink hover:underline"
            >
              {product.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Reveal animation="left" className={`${CARD} p-3 sm:p-5`}>
          <div className="rounded-card relative overflow-hidden bg-white">
            <div className="relative aspect-square">
              {gallery.map((url, position) => (
                <Image
                  key={url}
                  src={url}
                  alt={position === index ? product.name : ""}
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  priority={position === 0}
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className={`object-contain p-6 transition-opacity duration-500 ${
                    position === index ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => step(-1)}
                  className="focus-ring text-ink absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-sm transition-colors hover:bg-white"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => step(1)}
                  className="focus-ring text-ink absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-sm transition-colors hover:bg-white"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {gallery.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-2.5">
              {gallery.map((url, position) => (
                <li key={url}>
                  <button
                    type="button"
                    aria-label={`Show photo ${position + 1}`}
                    aria-current={position === index}
                    onClick={() => setActive(position)}
                    className={`focus-ring rounded-card relative block h-20 w-20 overflow-hidden border transition-all ${
                      position === index
                        ? "border-ink scale-[1.03]"
                        : "border-[#e4e4e4] opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-contain p-1"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        <Reveal animation="right" className={`${CARD} p-5 sm:p-8 lg:p-10`}>
          <h1 className="text-display-sm font-sans font-normal tracking-[-0.02em] text-black">
            {product.name}
          </h1>

          <p className="text-ink text-display-sm mt-4 flex flex-wrap items-baseline gap-3 font-sans font-medium">
            <span className={product.compareAtPriceMinor ? "text-olive" : undefined}>
              {formatMoney(product.priceMinor, product.currency)}
            </span>
            {product.compareAtPriceMinor !== null && (
              <>
                <s className="text-base font-normal text-neutral-500">
                  <span className="sr-only">Was </span>
                  {formatMoney(product.compareAtPriceMinor, product.currency)}
                </s>
                {product.discountPercent !== null && product.discountPercent > 0 && (
                  <span className="bg-olive text-caption tracking-label rounded-full px-2 py-0.5 font-semibold text-white uppercase">
                    Save {product.discountPercent}%
                  </span>
                )}
              </>
            )}
          </p>

          {/* The date, not a countdown: a ticking clock on a product page is a
              pressure tactic, and a customer who comes back tomorrow should be
              able to tell whether they still have time. */}
          {product.saleEndsAt && (
            <p className="mt-1 text-sm text-neutral-600">
              Sale price until{" "}
              {new Date(product.saleEndsAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
              })}
              .
            </p>
          )}

          {reviews && reviews.summary.count > 0 && (
            <a
              href="#reviews-heading"
              className="focus-ring mt-3 inline-flex items-center gap-2 text-sm"
            >
              <StarRating value={reviews.summary.average} />
              <span className="text-[#666666]">
                {reviews.summary.average.toFixed(1)} ({reviews.summary.count}{" "}
                {reviews.summary.count === 1 ? "review" : "reviews"})
              </span>
            </a>
          )}

          <p
            className={`mt-2 text-sm font-medium uppercase ${
              product.inStock ? "text-[#169543]" : "text-[#d9534f]"
            }`}
          >
            {product.inStock ? "In stock" : "Out of stock"}
          </p>

          {/* Shown only when the API sends a figure, which it does only when
              stock is genuinely low. An urgency badge on everything is noise
              customers learn to ignore. */}
          {product.inStock && product.lowStockRemaining !== null && (
            <p role="status" className="mt-1 text-sm font-medium text-[#b45309]">
              Only {product.lowStockRemaining} left in stock
            </p>
          )}

          {product.description && (
            <p className="text-meta mt-6 max-w-prose leading-relaxed text-[#444444]">
              {product.description}
            </p>
          )}

          {product.inStock ? (
            <div ref={buyRef} className="mt-8 flex flex-wrap items-center gap-2.5">
              <QuantityStepper
                quantity={quantity}
                label={product.name}
                // Capped at what the shop actually has. Letting someone pick
                // eight of something there are two of only moves the bad news
                // to checkout, after they have typed an address.
                {...(product.lowStockRemaining !== null
                  ? { max: product.lowStockRemaining }
                  : {})}
                onChange={(next) => setQuantity(Math.max(1, next))}
              />
              <AddToCartButton
                product={product}
                quantity={quantity}
                size="lg"
                openCartOnAdd
                className="hover:bg-lime hover:text-ink rounded-card px-11 py-4 tracking-[-0.02em]"
              />
            </div>
          ) : (
            <div className="rounded-card mt-8 bg-[#f9f9f9] px-4 py-4">
              <p className="text-sm text-[#444444]">
                This item is out of stock. Message us and we will tell you the moment it
                is back.
              </p>
              {/* A real link with the product already named in it — the old copy
                  told people to message WhatsApp and then made them find it,
                  and type out which product they meant. */}
              <a
                href={`${site.contact.whatsapp}?text=${encodeURIComponent(
                  `Hi, please let me know when "${product.name}" is back in stock.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring bg-ink rounded-card mt-3 inline-flex min-h-12 items-center justify-center px-6 text-sm font-medium text-white no-underline hover:no-underline"
              >
                Ask us on WhatsApp
              </a>
            </div>
          )}

          {/* Offered whether or not it is in stock — saving something that is
              out of stock is precisely when a customer wants the reminder. */}
          <div className="mt-4">
            <WishlistButton product={product} variant="inline" />
          </div>

          <dl className="mt-8 space-y-1 text-sm font-medium text-[#101010]">
            {product.sku && (
              <div className="flex gap-2">
                <dt>SKU:</dt>
                <dd className="text-[#a0a0a0]">{product.sku}</dd>
              </div>
            )}
            {product.categorySlug && product.categoryName && (
              <div className="flex gap-2">
                <dt>Category:</dt>
                <dd>
                  <Link
                    href={`/category/${product.categorySlug}`}
                    className="focus-ring hover:text-ink text-[#a0a0a0] transition-colors"
                  >
                    {product.categoryName}
                  </Link>
                </dd>
              </div>
            )}
            {product.brandSlug && product.brandName && (
              <div className="flex gap-2">
                <dt>Brand:</dt>
                <dd>
                  <Link
                    href={`/brand/${product.brandSlug}`}
                    className="focus-ring hover:text-ink text-[#a0a0a0] transition-colors"
                  >
                    {product.brandName}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </Reveal>
      </div>

      <ProductReviews slug={slug} productName={product.name} />

      {related.length > 0 && (
        <section
          aria-labelledby="related-heading"
          className="rounded-card mt-8 border border-[#e6e6e6] p-5 sm:p-8 lg:p-10"
        >
          <Reveal>
            <h2
              id="related-heading"
              className="tracking-label sm:text-display-sm font-sans text-2xl font-bold uppercase"
            >
              Related products
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-[#444444]">
              Here we got a hand full of products on discount, you can select from the
              options and get discount in checkout.
            </p>
          </Reveal>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((item, position) => (
              <Reveal as="li" key={item.id} delay={position * 120}>
                <FeatureProductCard product={item} index={position} />
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {product.inStock && !buyVisible && (
        <div className="safe-bottom border-card-line/70 fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-white/95 px-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[#666666]">{product.name}</p>
            <p className="text-ink text-base font-medium">
              {formatMoney(product.priceMinor, product.currency)}
            </p>
          </div>
          <AddToCartButton
            product={product}
            quantity={quantity}
            size="lg"
            openCartOnAdd
            className="rounded-card px-6"
          />
        </div>
      )}
    </div>
  );
}
