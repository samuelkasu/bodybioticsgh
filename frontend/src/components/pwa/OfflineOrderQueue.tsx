"use client";

import { useCallback, useEffect, useState } from "react";

import { usePlaceOrderMutation } from "@/lib/features/orders/ordersApi";
import {
  listQueuedOrders,
  recordAttempt,
  removeQueuedOrder,
} from "@/lib/offline/orderQueue";

/**
 * Sends orders that were placed while the connection was gone.
 *
 * Mounted in the root layout rather than on the checkout page: the customer who
 * loses signal mid-checkout is exactly the one who closes the tab, and the
 * replay has to happen wherever they next open the app.
 *
 * Every replay reuses the original requestId, so the API answers a request it
 * has already accepted with the original order instead of creating a second.
 */
export function OfflineOrderQueue() {
  const [placeOrder] = usePlaceOrderMutation();
  const [sent, setSent] = useState<number>(0);

  const replay = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const queued = await listQueuedOrders();
    if (queued.length === 0) return;

    let delivered = 0;

    for (const order of queued) {
      try {
        await placeOrder(order.payload).unwrap();
        await removeQueuedOrder(order.requestId);
        delivered += 1;
      } catch (error) {
        // Distinguish "the network is still down" from "the server rejected
        // this": a rejected order — an empty cart, a product withdrawn — will
        // never succeed, so retrying it forever only wastes the customer's data.
        const status = (error as { status?: number | string } | undefined)?.status;
        const rejected = typeof status === "number" && status >= 400 && status < 500;

        if (rejected) {
          await removeQueuedOrder(order.requestId);
        } else {
          await recordAttempt(order);
        }
      }
    }

    if (delivered > 0) setSent(delivered);
  }, [placeOrder]);

  useEffect(() => {
    // The rule cannot see through the async boundary: `replay` awaits
    // IndexedDB before it ever calls setState, so nothing is set synchronously
    // during the effect and there are no cascading renders. Replaying on mount
    // is the point — the customer who lost signal mid-checkout usually returns
    // by reopening the app, not by watching an `online` event fire.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void replay();

    const onOnline = () => void replay();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [replay]);

  if (sent === 0) return null;

  return (
    <div
      role="status"
      className="bg-olive fixed inset-x-0 bottom-0 z-50 px-4 py-3 text-center text-sm text-white"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {sent === 1
        ? "Your order has been sent now that you are back online."
        : `${sent} saved orders have been sent now that you are back online.`}{" "}
      <button
        type="button"
        onClick={() => setSent(0)}
        className="focus-ring ml-2 underline underline-offset-4"
      >
        Dismiss
      </button>
    </div>
  );
}
