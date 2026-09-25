"use client";

import Link from "next/link";

import { OrderActions } from "@/components/admin/OrderActions";
import { StatusBadge } from "@/components/admin/OrderQueue";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import { useAdminOrderQuery } from "@/lib/features/admin/adminApi";
import type { AdminOrder } from "@/lib/features/admin/adminApi";
import { formatMoney } from "@/lib/utils/money";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });

const TRIP_STATUS: Record<string, string> = {
  OUT_FOR_DELIVERY: "On the road",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};

const REFUND_METHOD: Record<string, string> = {
  MOBILE_MONEY: "Mobile Money",
  CASH: "Cash",
  HUBTEL: "Hubtel",
  BANK_TRANSFER: "Bank transfer",
};

export function OrderDetail({ reference }: { reference: string }) {
  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminOrderQuery(reference);

  if (isError) {
    return (
      <ErrorState
        message={apiErrorMessage(error, "We could not load that order.")}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !order) {
    return (
      <div role="status" aria-label="Loading order" className="grid gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin"
            className="focus-ring text-sm text-neutral-600 underline-offset-4 hover:underline"
          >
            ← Orders
          </Link>
          <h2 className="font-mono text-lg">{order.reference}</h2>
          <StatusBadge status={order.status} />
        </div>

        <section
          aria-labelledby="delivery"
          className="border-card-line/70 rounded-xl border p-5"
        >
          <h3 id="delivery" className="font-display text-ink text-lg">
            Deliver to
          </h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Name" value={order.fullName} />
            <Row
              label="Phone"
              value={
                <a
                  href={`tel:${order.phone.replace(/\s/g, "")}`}
                  className="focus-ring underline-offset-4 hover:underline"
                >
                  {order.phone}
                </a>
              }
            />
            <Row
              label="Email"
              value={
                <a
                  href={`mailto:${order.email}`}
                  className="focus-ring underline-offset-4 hover:underline"
                >
                  {order.email}
                </a>
              }
            />
            <Row label="Address" value={`${order.addressLine}, ${order.city}`} />
            {order.deliveryZoneName && (
              <Row label="Area" value={order.deliveryZoneName} />
            )}
            {order.notes && <Row label="Notes" value={order.notes} />}
          </dl>
        </section>

        <History order={order} />

        <section
          aria-labelledby="items"
          className="border-card-line/70 rounded-xl border p-5"
        >
          <h3 id="items" className="font-display text-ink text-lg">
            Items
          </h3>
          <ul className="mt-3 grid gap-2 text-sm">
            {order.lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-4">
                <span>
                  <Link
                    href={`/product/${line.slug}`}
                    className="focus-ring underline-offset-4 hover:underline"
                  >
                    {line.name}
                  </Link>
                  <span className="text-neutral-600"> × {line.quantity}</span>
                </span>
                <span className="whitespace-nowrap">
                  {formatMoney(line.lineTotalMinor, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-card-line/70 mt-4 flex justify-between border-t pt-3 text-sm text-neutral-600">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotalMinor, order.currency)}</span>
          </p>
          {/* Why the total is lower than the lines add up to. Without this a
              member of staff checking an order against its payment has no way
              to tell a discount from a mistake. */}
          {order.discountMinor > 0 && (
            <p className="mt-1 flex justify-between gap-3 text-sm text-neutral-600">
              <span className="min-w-0">
                {order.discountDescription ?? "Discount"}
                {order.couponCode && (
                  <span className="text-neutral-500"> — code {order.couponCode}</span>
                )}
              </span>
              <span className="shrink-0">
                − {formatMoney(order.discountMinor, order.currency)}
              </span>
            </p>
          )}
          <p className="mt-1 flex justify-between text-sm text-neutral-600">
            <span>
              Delivery
              {order.deliveryZoneName && (
                <span className="text-neutral-500"> — {order.deliveryZoneName}</span>
              )}
            </span>
            <span>
              {order.deliveryFeeMinor === 0
                ? "Free"
                : formatMoney(order.deliveryFeeMinor, order.currency)}
            </span>
          </p>
          <p className="border-card-line/70 mt-2 flex justify-between border-t pt-2 font-medium">
            <span>Total</span>
            <span>{formatMoney(order.totalMinor, order.currency)}</span>
          </p>
          {/* Said plainly because this is the figure a rider collects at the
              door on a pay-on-delivery order. */}
          <p className="mt-2 text-xs text-neutral-500">
            Goods plus delivery, as quoted to the customer at checkout.
          </p>
        </section>
      </div>

      <aside className="border-card-line/70 h-fit rounded-xl border p-5">
        <h3 className="font-display text-ink mb-4 text-lg">Move this order on</h3>

        <OrderActions order={order} />

        <p className="mt-5 text-xs text-neutral-500">
          Last updated {when(order.updatedAt)}
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

/** Every trip and every refund, oldest first — what happened, not just where it ended. */
function History({ order }: { order: AdminOrder }) {
  if (order.deliveries.length === 0 && order.refunds.length === 0 && !order.paidAt) {
    return null;
  }

  return (
    <section
      aria-labelledby="history"
      className="border-card-line/70 rounded-xl border p-5"
    >
      <h3 id="history" className="font-display text-ink text-lg">
        Delivery and payment
      </h3>

      <ul className="mt-3 grid gap-3 text-sm">
        {order.paidAt && (
          <li>
            <span className="text-ink font-medium">
              Paid {formatMoney(order.amountPaidMinor, order.currency)}
            </span>
            <span className="text-neutral-500"> — {when(order.paidAt)}</span>
          </li>
        )}

        {order.deliveries.map((trip) => (
          <li key={trip.id}>
            <span className="text-ink font-medium">
              {TRIP_STATUS[trip.status] ?? trip.status}
            </span>{" "}
            with {trip.riderName}
            {trip.courierName && ` (${trip.courierName})`}, {trip.riderPhone}
            <span className="text-neutral-500"> — sent {when(trip.dispatchedAt)}</span>
            {trip.deliveredAt && (
              <span className="text-neutral-500">
                , delivered {when(trip.deliveredAt)}
              </span>
            )}
            {trip.collectedMinor !== null && (
              <span className="block text-neutral-600">
                Collected {formatMoney(trip.collectedMinor, order.currency)} by{" "}
                {trip.collectedVia === "mobilemoney" ? "Mobile Money" : "cash"}
              </span>
            )}
            {trip.failureReason && (
              <span className="block text-red-800">{trip.failureReason}</span>
            )}
            {trip.notes && <span className="block text-neutral-600">{trip.notes}</span>}
          </li>
        ))}

        {order.refunds.map((refund) => (
          <li key={refund.id}>
            <span className="text-ink font-medium">
              Refunded {formatMoney(refund.amountMinor, order.currency)}
            </span>{" "}
            by {REFUND_METHOD[refund.method] ?? refund.method}
            {refund.reference && ` (${refund.reference})`}
            <span className="text-neutral-500"> — {when(refund.createdAt)}</span>
            <span className="block text-neutral-600">
              {refund.reason}
              {refund.restockedUnits > 0 && ` · ${refund.restockedUnits} back to stock`}
            </span>
          </li>
        ))}
      </ul>

      {order.refundedMinor > 0 && (
        <p className="border-card-line/70 mt-3 border-t pt-2 text-sm text-neutral-600">
          {formatMoney(order.refundedMinor, order.currency)} refunded of{" "}
          {formatMoney(order.amountPaidMinor, order.currency)} paid.
        </p>
      )}
    </section>
  );
}
