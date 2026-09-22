"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/admin/OrderQueue";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import {
  useAdminOrderQuery,
  useAdminUpdateOrderStatusMutation,
} from "@/lib/features/admin/adminApi";
import { formatMoney } from "@/lib/utils/money";

/**
 * What each status can become, mirroring Order.TryTransitionTo on the server.
 * Duplicated deliberately: the server is the authority and refuses anything
 * else, but offering a button that always fails is its own kind of bug.
 */
const NEXT_STATUSES: Record<
  string,
  { value: string; label: string; danger?: boolean }[]
> = {
  PENDING: [
    { value: "paid", label: "Mark paid" },
    { value: "cancelled", label: "Cancel order", danger: true },
  ],
  PAID: [
    { value: "fulfilled", label: "Mark delivered" },
    { value: "refunded", label: "Refund", danger: true },
  ],
  FULFILLED: [{ value: "refunded", label: "Refund", danger: true }],
  CANCELLED: [],
  REFUNDED: [],
};

export function OrderDetail({ reference }: { reference: string }) {
  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminOrderQuery(reference);
  const [updateStatus, { isLoading: isUpdating }] = useAdminUpdateOrderStatusMutation();
  const [failure, setFailure] = useState<string | null>(null);

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

  const transitions = NEXT_STATUSES[order.status] ?? [];

  const onTransition = async (status: string) => {
    setFailure(null);
    try {
      await updateStatus({ reference, status }).unwrap();
    } catch (caught) {
      setFailure(apiErrorMessage(caught, "That change was refused."));
    }
  };

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
        <h3 className="font-display text-ink text-lg">Move this order on</h3>

        {transitions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            An order that is {order.status.toLowerCase()} is finished — there is nothing
            further to do with it.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {transitions.map((transition) => (
              <Button
                key={transition.value}
                variant={transition.danger ? "outline" : "primary"}
                fullWidth
                disabled={isUpdating}
                onClick={() => void onTransition(transition.value)}
              >
                {transition.label}
              </Button>
            ))}
          </div>
        )}

        {order.status === "PENDING" && (
          <p className="mt-3 text-xs text-neutral-500">
            Cancelling returns the reserved stock to the catalogue.
          </p>
        )}

        {failure && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {failure}
          </p>
        )}

        <p className="mt-5 text-xs text-neutral-500">
          Last updated{" "}
          {new Date(order.updatedAt).toLocaleString("en-GB", {
            dateStyle: "short",
            timeStyle: "short",
          })}
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
