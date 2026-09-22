"use client";

import { useEffect } from "react";

import { updateAvailable } from "@/lib/features/network/networkSlice";
import { useAppDispatch } from "@/lib/store/hooks";

/**
 * Registration is manual because the service worker is built by the Serwist
 * CLI after `next build` (see serwist.config.mts) rather than by the webpack
 * plugin that would otherwise inject a registration snippet.
 */
export function ServiceWorkerRegistrar() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Dev builds have no generated worker, so there is nothing to register.
      // But a worker left over from a production run on this same origin keeps
      // serving its precached HTML and CSS, and the dev server's changes never
      // appear — the page looks stale in ways that read like a styling bug.
      // Tear it down instead of merely skipping registration.
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      })();

      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;

        if (registration.waiting) dispatch(updateAvailable(true));

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" with an existing controller means a newer build is
            // ready and waiting, not a first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              dispatch(updateAvailable(true));
            }
          });
        });
      } catch (error) {
        // A failed registration must never break the page: the app still works
        // online, just without offline support.
        console.error("Service worker registration failed", error);
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
}
