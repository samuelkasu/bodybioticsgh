/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next: the hashed build assets.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const ONE_DAY = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Take over immediately. For a storefront, a half-updated app (old shell,
  // new API) is riskier than a forced refresh — prices and stock must match.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      // Product imagery dominates page weight and is immutable per URL, so
      // serve from cache and cap the bucket to protect the device quota.
      matcher: ({ request, url }) =>
        request.destination === "image" && url.origin === self.location.origin,
      handler: new CacheFirst({
        cacheName: "product-images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 120,
            maxAgeSeconds: 30 * ONE_DAY,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      // Never cache auth, cart mutations or checkout: a replayed cart response
      // shows a customer someone else's state or a stale total.
      matcher: ({ url, request }) =>
        url.pathname.startsWith("/api/") &&
        (request.method !== "GET" ||
          url.pathname.startsWith("/api/auth/") ||
          url.pathname.startsWith("/api/cart") ||
          url.pathname.startsWith("/api/checkout") ||
          url.pathname.startsWith("/api/orders") ||
          url.pathname.startsWith("/api/contact")),
      handler: new NetworkOnly(),
    },
    {
      // Catalogue reads: fresh when online, last-known list when the tunnel
      // drops mid-scroll. 3s timeout keeps a dying connection from hanging.
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        (url.pathname.startsWith("/api/products") ||
          url.pathname.startsWith("/api/categories") ||
          url.pathname.startsWith("/api/brands")),
      handler: new NetworkFirst({
        cacheName: "api-catalogue",
        networkTimeoutSeconds: 3,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: ONE_DAY }),
        ],
      }),
    },
    {
      // Fonts change almost never; a revalidation round-trip per launch is
      // wasted latency on mobile data.
      matcher: ({ request }) => request.destination === "font",
      handler: new CacheFirst({
        cacheName: "fonts",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 365 * ONE_DAY }),
        ],
      }),
    },
    {
      matcher: ({ request }) =>
        request.destination === "style" || request.destination === "script",
      handler: new StaleWhileRevalidate({ cacheName: "static-resources" }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// Lets the in-app "update available" prompt activate a waiting worker.
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === "SKIP_WAITING") void self.skipWaiting();
});

serwist.addEventListeners();
