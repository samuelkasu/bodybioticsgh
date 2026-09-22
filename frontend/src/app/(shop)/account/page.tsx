"use client";

import Link from "next/link";

import { PriceTag } from "@/components/commerce/PriceTag";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import { apiErrorMessage } from "@/lib/api/http";
import { useGetSessionQuery, useLogoutMutation } from "@/lib/features/auth/authApi";
import { useGetOrdersQuery } from "@/lib/features/orders/ordersApi";

export default function AccountPage() {
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const orders = useGetOrdersQuery(undefined, { skip: !session?.user });

  if (sessionLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Skeleton className="h-8 w-40" />
      </main>
    );
  }

  // proxy.ts redirects unauthenticated visitors, but a session can expire
  // between that check and this render.
  if (!session?.user) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <EmptyState
          title="You are signed out"
          description="Sign in to see your orders."
          action={
            <Link href="/account/login" className="focus-ring">
              <Button>Sign in</Button>
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">My account</h1>
          <p className="mt-1 text-sm text-neutral-600">{session.user.email}</p>
        </div>
        <Button variant="outline" disabled={loggingOut} onClick={() => void logout()}>
          {loggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      <section aria-labelledby="orders-heading" className="mt-8">
        <h2 id="orders-heading" className="text-lg">
          Your orders
        </h2>

        {orders.isLoading && <Skeleton className="mt-3 h-24 w-full" />}

        {orders.isError && (
          <div className="mt-3">
            <ErrorState
              message={apiErrorMessage(orders.error, "We could not load your orders.")}
              onRetry={() => void orders.refetch()}
            />
          </div>
        )}

        {orders.data?.length === 0 && (
          <div className="mt-3">
            <EmptyState
              title="No orders yet"
              description="Your orders will appear here once you place one."
              action={
                <Link href="/shop" className="focus-ring">
                  <Button>Shop now</Button>
                </Link>
              }
            />
          </div>
        )}

        {orders.data && orders.data.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {orders.data.map((order) => (
              <li
                key={order.reference}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <Link
                    href={`/order/${order.reference}`}
                    className="focus-ring font-medium hover:underline"
                  >
                    {order.reference}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    {new Date(order.createdAt).toLocaleDateString("en-GB")} ·{" "}
                    {order.status}
                  </p>
                </div>
                <PriceTag amountMinor={order.totalMinor} currency={order.currency} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
