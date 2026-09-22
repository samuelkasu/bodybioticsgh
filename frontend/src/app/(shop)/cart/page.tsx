"use client";

import Link from "next/link";

import { CartTable } from "@/components/commerce/CartTable";
import { CouponForm } from "@/components/commerce/CouponForm";
import { Button } from "@/components/ui/Button";
import { ShippingIcon } from "@/components/ui/Icons";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { useGetCartQuery } from "@/lib/features/cart/cartApi";
import {
  selectCartCurrency,
  selectCartDiscountedSubtotalMinor,
  selectCartDiscounts,
  selectCartFreeDeliveryGranted,
  selectCartItemCount,
  selectCartSubtotalMinor,
  selectHasUnavailableLines,
} from "@/lib/features/cart/cartSlice";
import { site } from "@/lib/site";
import { useAppSelector } from "@/lib/store/hooks";
import { formatMoney } from "@/lib/utils/money";

export default function CartPage() {
  // Reconciles the optimistic mirror with the server on every visit.
  const { isLoading, isFetching, refetch } = useGetCartQuery();
  const itemCount = useAppSelector(selectCartItemCount);
  const subtotalMinor = useAppSelector(selectCartSubtotalMinor);
  const discountedSubtotalMinor = useAppSelector(selectCartDiscountedSubtotalMinor);
  const discounts = useAppSelector(selectCartDiscounts);
  const freeDeliveryGranted = useAppSelector(selectCartFreeDeliveryGranted);
  const currency = useAppSelector(selectCartCurrency);
  const hasUnavailableLines = useAppSelector(selectHasUnavailableLines);

  // Against the discounted goods: the server tests the threshold on what the
  // customer actually pays for goods, and the bar here must agree with it.
  const remainingForFreeDelivery =
    site.freeDeliveryThresholdMinor - discountedSubtotalMinor;

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-6">
      <h1 className="sr-only">Your cart</h1>

      {/*
        Until the server cart is in, neither branch below is known to be right.
        Rendering the totals panel against an empty mirror was the worse guess:
        a full-height panel collapsed into the short empty state the moment the
        response landed and dragged the footer 900px up the page with it — 0.21
        of this page's 0.23 CLS, on its own.
      */}
      <div className="min-h-[65svh]">
        {isLoading ? (
          // Sized to the box it sits in rather than to a cart nobody has
          // counted yet: whichever branch follows, the footer does not move.
          <div
            role="status"
            aria-label="Loading your cart"
            className="grid h-[65svh] gap-5"
          >
            <Skeleton className="h-full" />
          </div>
        ) : itemCount === 0 ? (
          <EmptyState
            title="Your cart is empty"
            description="Browse the catalogue and add something you like."
            action={
              <Link href="/shop" className="focus-ring">
                <Button>Shop now</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5">
            <section aria-label="Cart items">
              <CartTable />

              {/* Quantities save as they change; this re-reads the server cart,
                which is what the original's Update Cart ends up doing. */}
              <div className="mt-4 flex justify-end">
                <Button
                  variant="sand"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="rounded-control"
                >
                  {isFetching ? "Updating…" : "Update Cart"}
                </Button>
              </div>
            </section>

            <section
              aria-labelledby="cart-totals-heading"
              className="rounded-control border-2 border-dashed border-[#8b745b] p-6 sm:p-8"
            >
              <h2 id="cart-totals-heading" className="sr-only">
                Cart totals
              </h2>

              <dl>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xl font-bold text-[#101010]">Subtotal</dt>
                  <dd className="text-xl font-bold text-[#101010]">
                    {formatMoney(subtotalMinor, currency)}
                  </dd>
                </div>

                {discounts.map((discount, index) => (
                  <div
                    key={`${discount.source}-${index}`}
                    className="mt-4 flex items-start justify-between gap-4"
                  >
                    <dt className="min-w-0 text-base font-medium text-[#556827]">
                      {discount.label}
                    </dt>
                    <dd className="shrink-0 text-base font-bold text-[#556827]">
                      {discount.amountMinor > 0
                        ? `− ${formatMoney(discount.amountMinor, currency)}`
                        : "Free delivery"}
                    </dd>
                  </div>
                ))}

                <div className="mt-6 border-t border-[#e6e0d6] pt-6">
                  <dt className="text-xl font-bold text-[#101010]">Shipment:</dt>
                  <dd className="mt-4 text-lg font-bold text-[#101010]">
                    {freeDeliveryGranted
                      ? "Free on this order."
                      : "Shipping costs are calculated during checkout."}
                  </dd>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#e6e0d6] pt-6">
                  <dt className="text-xl font-bold text-[#101010]">Total</dt>
                  <dd className="text-xl font-bold text-[#556827]">
                    {formatMoney(discountedSubtotalMinor, currency)}
                  </dd>
                </div>
              </dl>

              <CouponForm className="mt-6" />

              {freeDeliveryGranted ? (
                <p className="bg-lime/20 text-cocoa rounded-control mt-6 px-4 py-3 text-sm">
                  Delivery is free on this order.
                </p>
              ) : remainingForFreeDelivery > 0 ? (
                // The gap, not the threshold. "Spend GH₵2,000 or more" makes the
                // customer do the subtraction; "add GH₵350 more" is the sentence
                // that actually moves a basket.
                <div className="bg-blush/60 text-cocoa rounded-control mt-6 px-4 py-3 text-sm">
                  <p>
                    Add {formatMoney(remainingForFreeDelivery, currency)} more for free
                    nationwide delivery.
                  </p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={site.freeDeliveryThresholdMinor}
                    aria-valuenow={discountedSubtotalMinor}
                    aria-label="Progress towards free delivery"
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70"
                  >
                    <div
                      className="bg-olive h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (discountedSubtotalMinor / site.freeDeliveryThresholdMinor) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="bg-lime/20 text-cocoa rounded-control mt-6 px-4 py-3 text-sm">
                  Your order qualifies for free nationwide delivery.
                </p>
              )}

              {/* A dead button with the reason somewhere else up the page is the
                version of this that generates support messages. */}
              {hasUnavailableLines && (
                <p
                  role="alert"
                  className="rounded-control mt-6 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  One of your items is no longer available in the quantity you asked for.
                  Reduce it above and checkout will open again.
                </p>
              )}

              <div className="mt-6 flex justify-end">
                <Link
                  href="/checkout"
                  className="focus-ring"
                  aria-disabled={hasUnavailableLines}
                >
                  <Button size="lg" disabled={hasUnavailableLines} className="px-10">
                    {/* The mark is a hairline outline; a stroke fattens it to
                      sit level with the label. */}
                    <ShippingIcon
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth={8}
                    />
                    Proceed to checkout
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
