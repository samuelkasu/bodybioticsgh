"use client";

import Link from "next/link";
import { useState } from "react";

import { PriceTag } from "@/components/commerce/PriceTag";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import { useGetOrderQuery, type Order } from "@/lib/features/orders/ordersApi";
import { site } from "@/lib/site";
import { formatMoney } from "@/lib/utils/money";

/**
 * How often the page re-asks while a payment settles. Hubtel's callback usually
 * lands within seconds, but it can be late, and on a customer's phone a page
 * that says "unpaid" after they have paid is alarming — so the page asks rather
 * than waiting to be told.
 */
const PAYMENT_POLL_MS = 4_000;

const STATUS_COPY: Record<string, string> = {
  PENDING: "We have your order and will call to confirm delivery.",
  PAID: "Payment received. Your order is being prepared.",
  DISPATCHED: "On its way. The rider will call you when they are close.",
  FULFILLED: "Delivered. Thank you for shopping with us.",
  CANCELLED: "This order was cancelled.",
  REFUNDED: "This order was refunded.",
};

const isAwaitingPayment = (order: Order) =>
  order.paymentMethod === "HUBTEL" && order.status === "PENDING";

export function OrderConfirmation({ reference }: { reference: string }) {
  const [pollingInterval, setPollingInterval] = useState(PAYMENT_POLL_MS);

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetOrderQuery(reference, { pollingInterval });

  // Adjusting state during render rather than in an effect: the hook cannot
  // read its own result, and this is the case React documents the pattern for.
  // Polling starts on, and switches off the moment the first response shows
  // there is nothing left to wait for — so a receipt left open on a phone is
  // not hitting the API over mobile data all afternoon.
  if (pollingInterval !== 0 && order && !isAwaitingPayment(order)) {
    setPollingInterval(0);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <ErrorState
        title="We could not find that order"
        message={apiErrorMessage(error, "Check the reference and try again.")}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div>
      <p className="text-taupe text-sm font-medium tracking-wide uppercase">
        Order confirmed
      </p>
      <h1 className="mt-1 text-2xl">Thank you</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {isAwaitingPayment(order)
          ? "Waiting for Hubtel to confirm your payment. This page updates itself."
          : (STATUS_COPY[order.status] ?? "We are processing your order.")}
      </p>

      {isAwaitingPayment(order) && order.checkoutUrl && (
        // The customer may have closed Hubtel's page by accident. The same
        // invoice is reused, so this cannot create a second charge.
        <a
          href={order.checkoutUrl}
          className="focus-ring bg-ink hover:bg-cocoa rounded-card mt-4 inline-flex min-h-12 items-center justify-center px-6 text-base font-medium text-white no-underline transition-colors hover:no-underline"
        >
          Finish paying
        </a>
      )}

      <dl className="mt-6 grid gap-2 rounded-xl border border-neutral-200 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Reference</dt>
          {/* Read out over the phone when a customer calls about delivery. */}
          <dd className="font-medium tracking-wide">{order.reference}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Email</dt>
          <dd>{order.email}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Placed</dt>
          <dd>{new Date(order.createdAt).toLocaleDateString("en-GB")}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Status</dt>
          <dd>{order.status}</dd>
        </div>
        {/* Shown back to them deliberately: a mistyped house number is cheap to
            catch here and expensive to catch when the rider is lost. */}
        <div className="sm:col-span-2">
          <dt className="text-neutral-500">Delivering to</dt>
          <dd>
            {order.fullName} · {order.phone}
            <br />
            {order.addressLine}, {order.city}
            {order.deliveryZoneName ? ` (${order.deliveryZoneName})` : ""}
          </dd>
        </div>
      </dl>

      {order.status === "PENDING" && order.paymentMethod === "ON_DELIVERY" && (
        <section
          aria-labelledby="next-heading"
          className="bg-sand/30 mt-6 rounded-xl p-4"
        >
          <h2 id="next-heading" className="text-base font-medium">
            What happens next
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
            <li>We call {order.phone} to confirm the order and the address.</li>
            <li>Your items are packed and handed to a rider.</li>
            <li>
              You pay {formatMoney(order.totalMinor, order.currency)} in cash or Mobile
              Money when it arrives.
            </li>
          </ol>
          <p className="mt-3 text-xs text-neutral-600">
            Something wrong with this order? Message us on WhatsApp with the reference
            above and we will fix it before it goes out.
          </p>
        </section>
      )}

      <section aria-labelledby="order-items-heading" className="mt-6">
        <h2 id="order-items-heading" className="text-lg">
          Items
        </h2>

        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          {order.lines.map((line) => (
            <li
              key={line.productId}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/product/${line.slug}`}
                  className="focus-ring text-sm hover:underline"
                >
                  <span className="line-clamp-2">{line.name}</span>
                </Link>
                <p className="text-xs text-neutral-500">
                  {line.quantity} ×{" "}
                  <PriceTag
                    amountMinor={line.unitPriceMinor}
                    compareAtMinor={line.listPriceMinor}
                    currency={order.currency}
                    size="sm"
                  />
                </p>
              </div>
              <PriceTag amountMinor={line.lineTotalMinor} currency={order.currency} />
            </li>
          ))}
        </ul>

        {/* The same three lines the customer agreed to at checkout. A receipt
            showing one figure is the one that gets queried on the doorstep. */}
        <dl className="mt-3 space-y-2 border-t border-neutral-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd>
              <PriceTag amountMinor={order.subtotalMinor} currency={order.currency} />
            </dd>
          </div>
          {order.discountMinor > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-olive min-w-0">
                {order.discountDescription ?? "Discount"}
                {order.couponCode && (
                  <span className="block text-xs text-neutral-500">
                    Code {order.couponCode}
                  </span>
                )}
              </dt>
              <dd className="text-olive shrink-0 font-medium">
                −<PriceTag amountMinor={order.discountMinor} currency={order.currency} />
              </dd>
            </div>
          )}

          <div className="flex justify-between gap-3">
            <dt className="text-neutral-600">
              Delivery
              {order.deliveryZoneName && (
                <span className="block text-xs text-neutral-500">
                  {order.deliveryZoneName}
                </span>
              )}
            </dt>
            <dd className="text-right">
              {order.deliveryFeeMinor === 0 ? (
                <span className="text-olive font-medium">Free</span>
              ) : (
                <PriceTag
                  amountMinor={order.deliveryFeeMinor}
                  currency={order.currency}
                />
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
            <dt className="font-medium">Total</dt>
            <dd>
              <PriceTag
                amountMinor={order.totalMinor}
                currency={order.currency}
                size="lg"
              />
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop" className="focus-ring">
          <Button>Continue shopping</Button>
        </Link>
        <a href={site.contact.whatsapp} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">Message us on WhatsApp</Button>
        </a>
      </div>
    </div>
  );
}
