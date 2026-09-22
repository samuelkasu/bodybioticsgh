import type { CheckoutPayload } from "@/lib/features/orders/ordersApi";

/**
 * Checkouts that could not reach the API, held until the connection returns.
 *
 * IndexedDB rather than localStorage: this holds a customer's name, address and
 * phone number, it must survive a reload, and localStorage is both synchronous
 * (blocking the main thread on a slow device) and the first thing iOS evicts.
 *
 * Background Sync would be the obvious mechanism and Safari does not implement
 * it, so replay is driven by the app instead — on reconnect and on next open.
 * See docs/SETUP.md §6.1.
 */

const DB_NAME = "bodybiotics";
const DB_VERSION = 1;
const STORE = "pending-orders";

export type QueuedOrder = {
  /**
   * The checkout's idempotency key, and the primary key here. Replaying a
   * request the server already accepted returns the original order rather than
   * creating a second one, which is what makes retrying safe at all.
   */
  requestId: string;
  payload: CheckoutPayload;
  queuedAt: number;
  attempts: number;
};

/** Past this, replaying is more likely to confuse than to help. */
export const MAX_ATTEMPTS = 5;

export const isIndexedDbAvailable = (): boolean =>
  typeof indexedDB !== "undefined" && indexedDB !== null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "requestId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
    // Private browsing on iOS opens the database and then blocks on it.
    request.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB write failed"));
        transaction.oncomplete = () => db.close();
      }),
  );
}

/**
 * Every call here swallows its own failure. A storage error must never be the
 * reason a customer cannot check out — the worst acceptable outcome is that the
 * order is not queued and they are told to try again.
 */
async function safely<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  if (!isIndexedDbAvailable()) return fallback;

  try {
    return await action();
  } catch {
    return fallback;
  }
}

export const enqueueOrder = (payload: CheckoutPayload): Promise<boolean> =>
  safely(async () => {
    const queued: QueuedOrder = {
      requestId: payload.requestId,
      payload,
      queuedAt: Date.now(),
      attempts: 0,
    };

    // put, not add: a customer who submits the same form twice while offline
    // has one pending order, not a duplicate that errors.
    await run("readwrite", (store) => store.put(queued));
    return true;
  }, false);

export const listQueuedOrders = (): Promise<QueuedOrder[]> =>
  safely(() => run<QueuedOrder[]>("readonly", (store) => store.getAll()), []);

export const removeQueuedOrder = (requestId: string): Promise<void> =>
  safely(async () => {
    await run("readwrite", (store) => store.delete(requestId));
  }, undefined);

export const recordAttempt = (order: QueuedOrder): Promise<void> =>
  safely(async () => {
    const next: QueuedOrder = { ...order, attempts: order.attempts + 1 };

    if (next.attempts >= MAX_ATTEMPTS) {
      // Given up on. The customer still has the order reference path open to
      // them through support, and silently retrying forever helps nobody.
      await run("readwrite", (store) => store.delete(order.requestId));
      return;
    }

    await run("readwrite", (store) => store.put(next));
  }, undefined);
