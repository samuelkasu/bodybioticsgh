import "fake-indexeddb/auto";

import type { CheckoutPayload } from "@/lib/features/orders/ordersApi";
import {
  MAX_ATTEMPTS,
  enqueueOrder,
  listQueuedOrders,
  recordAttempt,
  removeQueuedOrder,
} from "@/lib/offline/orderQueue";

const payload = (requestId: string): CheckoutPayload => ({
  email: "ama@example.com",
  fullName: "Ama Mensah",
  phone: "0241234567",
  addressLine: "12 Oxford Street",
  city: "Accra",
  deliveryZone: "accra-central",
  requestId,
  // Only pay-on-delivery orders are queued: an online one needs a live call to
  // the provider for a checkout URL.
  paymentMethod: "ON_DELIVERY",
});

describe("offline order queue", () => {
  beforeEach(async () => {
    for (const order of await listQueuedOrders()) {
      await removeQueuedOrder(order.requestId);
    }
  });

  it("keeps an order that could not be sent", async () => {
    expect(await enqueueOrder(payload("req-1"))).toBe(true);

    const queued = await listQueuedOrders();
    expect(queued).toHaveLength(1);
    expect(queued[0]!.payload.fullName).toBe("Ama Mensah");
    expect(queued[0]!.attempts).toBe(0);
  });

  it("does not duplicate a resubmitted order", async () => {
    // Same requestId: the customer pressed the button twice while offline.
    await enqueueOrder(payload("req-1"));
    await enqueueOrder(payload("req-1"));

    expect(await listQueuedOrders()).toHaveLength(1);
  });

  it("keeps two genuinely different orders apart", async () => {
    await enqueueOrder(payload("req-1"));
    await enqueueOrder(payload("req-2"));

    expect(await listQueuedOrders()).toHaveLength(2);
  });

  it("drops an order once it has been sent", async () => {
    await enqueueOrder(payload("req-1"));

    await removeQueuedOrder("req-1");

    expect(await listQueuedOrders()).toHaveLength(0);
  });

  it("counts attempts and gives up rather than retrying forever", async () => {
    await enqueueOrder(payload("req-1"));

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const [order] = await listQueuedOrders();
      if (!order) break;
      await recordAttempt(order);
    }

    // Retrying indefinitely burns a customer's mobile data on a request that
    // is never going to land.
    expect(await listQueuedOrders()).toHaveLength(0);
  });

  it("reports failure instead of throwing when storage is unavailable", async () => {
    const original = globalThis.indexedDB;
    // Private browsing on iOS, or a browser with storage disabled. Checkout
    // must still work; it just cannot queue.
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
    });

    await expect(enqueueOrder(payload("req-1"))).resolves.toBe(false);
    await expect(listQueuedOrders()).resolves.toEqual([]);

    Object.defineProperty(globalThis, "indexedDB", {
      value: original,
      configurable: true,
    });
  });
});
