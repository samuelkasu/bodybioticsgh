"use client";

import { useRef } from "react";

import { FeatureProductCard } from "@/components/commerce/FeatureProductCard";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { apiErrorMessage } from "@/lib/api/http";
import { selectIsLowBandwidth } from "@/lib/features/network/networkSlice";
import { useGetProductsQuery } from "@/lib/features/products/productsApi";
import { useAppSelector } from "@/lib/store/hooks";

/**
 * Fixed widths on phones, then exactly four cards across the track on desktop:
 * a fixed width there leaves the fourth card clipped by the container edge.
 */
const CARD_TRACK_ITEM =
  "shrink-0 snap-start basis-[260px] sm:basis-[300px] xl:basis-[calc((100%-4.5rem)/4)]";

/**
 * Featured products over a full-bleed photograph, as on the original: cream
 * eyebrow and white serif heading on the image, then a horizontal carousel.
 *
 * Scroll-snap rather than a carousel library: it swipes natively on a phone,
 * keeps keyboard and scrollbar behaviour, and ships no extra JavaScript.
 */
export function FeaturedCarousel() {
  const scroller = useRef<HTMLUListElement>(null);
  const isLowBandwidth = useAppSelector(selectIsLowBandwidth);
  const perPage = isLowBandwidth ? 6 : 12;

  const { data, isLoading, isError, error, refetch } = useGetProductsQuery({
    perPage,
    sort: "alpha",
  });

  const scrollBy = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    // One card plus its gap, so a click always lands on a card edge. The card
    // width is responsive, so measure it rather than assuming.
    const card = node.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 24 : 320;
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section
      aria-labelledby="featured-heading"
      className="defer-paint relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/brand/featured-bg.webp')] bg-cover bg-center"
      />
      {/* Keeps the white heading legible over the photograph. */}
      <div aria-hidden="true" className="bg-cocoa-deep/45 absolute inset-0" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
        <p className="text-sand tracking-caps-wide text-xs font-semibold uppercase sm:text-sm">
          Featured products
        </p>
        <h2 id="featured-heading" className="text-display-md mt-3 max-w-xl text-white">
          Body Biotics, high-quality personal care.
        </h2>

        <div className="relative mt-8">
          {isError ? (
            <ErrorState
              message={apiErrorMessage(error, "We could not load the catalogue.")}
              onRetry={() => void refetch()}
            />
          ) : (
            <>
              <ul
                ref={scroller}
                className="flex snap-x snap-mandatory [scrollbar-width:none] gap-6 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden"
              >
                {isLoading
                  ? Array.from({ length: 4 }, (_, index) => (
                      <li key={index} className={CARD_TRACK_ITEM}>
                        <Skeleton className="h-[420px] w-full" />
                      </li>
                    ))
                  : (data?.items ?? []).map((product, index) => (
                      <li key={product.id} className={CARD_TRACK_ITEM}>
                        <FeatureProductCard product={product} index={index} />
                      </li>
                    ))}
              </ul>

              {/* Hidden on touch: swiping is the primary interaction there. */}
              <button
                type="button"
                aria-label="Previous products"
                onClick={() => scrollBy(-1)}
                className="focus-ring bg-brand-lime rounded-panel absolute top-1/2 -left-5 hidden h-14 w-14 -translate-y-1/2 items-center justify-center text-white shadow-lg lg:flex"
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next products"
                onClick={() => scrollBy(1)}
                className="focus-ring bg-brand-lime rounded-panel absolute top-1/2 -right-5 hidden h-14 w-14 -translate-y-1/2 items-center justify-center text-white shadow-lg lg:flex"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
