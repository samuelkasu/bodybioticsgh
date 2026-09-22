"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { CouponForm } from "@/components/commerce/CouponForm";
import { PriceTag } from "@/components/commerce/PriceTag";
import {
  selectCartCurrency,
  selectCartDiscountedSubtotalMinor,
  selectCartDiscountMinor,
  selectCartDiscounts,
  selectCartFreeDeliveryGranted,
  selectCartItemCount,
  selectCartSubtotalMinor,
} from "@/lib/features/cart/cartSlice";
import { site } from "@/lib/site";
import { useAppSelector } from "@/lib/store/hooks";
import { formatMoney } from "@/lib/utils/money";

export type OrderSummaryProps = {
  /** Rendered under the totals: the checkout button, or a place-order button. */
  action?: ReactNode;
  /**
   * Delivery, once the customer has chosen an area. Null before they have —
   * the summary then says so plainly rather than showing a total that is
   * about to change.
   */
  deliveryFeeMinor?: number | null;
  /** The chosen area's name, shown beside the fee so the figure is explicable. */
  deliveryZoneName?: string | null;
};

export function OrderSummary({
  action,
  deliveryFeeMinor = null,
  deliveryZoneName = null,
}: OrderSummaryProps) {
  const itemCount = useAppSelector(selectCartItemCount);
  const subtotalMinor = useAppSelector(selectCartSubtotalMinor);
  const discountMinor = useAppSelector(selectCartDiscountMinor);
  const discountedSubtotalMinor = useAppSelector(selectCartDiscountedSubtotalMinor);
  const discounts = useAppSelector(selectCartDiscounts);
  const freeDeliveryGranted = useAppSelector(selectCartFreeDeliveryGranted);
  const currency = useAppSelector(selectCartCurrency);

  // Measured against the discounted goods, because that is what the server
  // tests the threshold against — see DeliveryZones.Quote.
  const remainingForFreeDelivery =
    site.freeDeliveryThresholdMinor - discountedSubtotalMinor;
  const totalMinor = discountedSubtotalMinor + (deliveryFeeMinor ?? 0);

  return (
    <section
      aria-labelledby="order-summary-heading"
      className="rounded-xl border border-neutral-200 p-4"
    >
      <h2 id="order-summary-heading" className="font-display text-lg">
        Order summary
      </h2>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">Items</dt>
          <dd className="tabular-nums">{itemCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">Subtotal</dt>
          <dd>
            <PriceTag amountMinor={subtotalMinor} currency={currency} />
          </dd>
        </div>
        {/* One row per offer rather than a single "Discount": a customer
            looking at GH₵48 off wants to know which offers made it up. */}
        {discounts.map((discount, index) => (
          <div key={`${discount.source}-${index}`} className="flex justify-between gap-3">
            <dt className="text-olive min-w-0">
              <span className="line-clamp-2">{discount.label}</span>
            </dt>
            <dd className="text-olive shrink-0 font-medium">
              {discount.amountMinor > 0 ? (
                <>
                  −<PriceTag amountMinor={discount.amountMinor} currency={currency} />
                </>
              ) : (
                "Free delivery"
              )}
            </dd>
          </div>
        ))}

        {discountMinor > 0 && (
          <div className="flex justify-between border-t border-neutral-200 pt-2">
            <dt className="text-neutral-600">Goods after discount</dt>
            <dd>
              <PriceTag amountMinor={discountedSubtotalMinor} currency={currency} />
            </dd>
          </div>
        )}

        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">
            Delivery
            {deliveryZoneName && (
              <span className="block text-xs text-neutral-500">{deliveryZoneName}</span>
            )}
          </dt>
          <dd className="text-right">
            {deliveryFeeMinor === null ? (
              // Still honest about not knowing, but it now points at the control
              // that resolves it instead of leaving the total a mystery until
              // the rider arrives.
              <span className="text-neutral-600">Choose an area</span>
            ) : deliveryFeeMinor === 0 ? (
              <span className="text-olive font-medium">Free</span>
            ) : (
              <PriceTag amountMinor={deliveryFeeMinor} currency={currency} />
            )}
          </dd>
        </div>

        {deliveryFeeMinor !== null && (
          <div className="flex justify-between border-t border-neutral-200 pt-2">
            <dt className="text-ink font-medium">Total</dt>
            <dd>
              <PriceTag amountMinor={totalMinor} currency={currency} size="lg" />
            </dd>
          </div>
        )}
      </dl>

      <CouponForm className="mt-3" />

      {freeDeliveryGranted ? (
        <p className="bg-brand-lime/20 text-cocoa mt-3 rounded-lg px-3 py-2 text-xs">
          Delivery is free on this order.
        </p>
      ) : remainingForFreeDelivery > 0 ? (
        // The gap rather than the threshold: the customer should not have to
        // subtract their own subtotal to know how close they are.
        <p className="bg-sand/40 text-cocoa mt-3 rounded-lg px-3 py-2 text-xs">
          Add {formatMoney(remainingForFreeDelivery, currency)} more for free nationwide
          delivery.
        </p>
      ) : (
        discountedSubtotalMinor > 0 && (
          <p className="bg-brand-lime/20 text-cocoa mt-3 rounded-lg px-3 py-2 text-xs">
            Your order qualifies for free nationwide delivery.
          </p>
        )
      )}

      {action && <div className="mt-4">{action}</div>}

      <p className="mt-3 text-center text-xs text-neutral-500">
        Questions?{" "}
        <Link href="/contact" className="focus-ring underline">
          Contact us
        </Link>
      </p>
    </section>
  );
}
