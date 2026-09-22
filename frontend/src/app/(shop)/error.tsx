"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Last line of defence for a render error inside the shell — the header, footer
 * and cart drawer stay mounted, so the customer is never stranded on a blank
 * screen with no way back.
 *
 * Installed PWAs have no browser error page and no address bar to retype, which
 * is why "Try again" and a link into the catalogue both have to be here.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with the error tracker when one is wired up (THINGS-TO-DO §3).
    // Until then this is the only trace a customer-side failure leaves.
    console.error("Unhandled render error", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">Something went wrong</h1>

      <p className="mt-3 max-w-md text-base text-neutral-600">
        The page did not load properly. Trying again usually fixes it — your cart is safe
        either way.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/shop"
          className="focus-ring border-ink text-ink hover:bg-ink rounded-card inline-flex min-h-12 items-center justify-center border px-6 text-base font-medium transition-colors duration-200 hover:text-white"
        >
          Back to the shop
        </Link>
      </div>

      {error.digest && (
        // Quoting this to support turns "it broke" into a searchable log line.
        <p className="mt-10 text-xs text-neutral-500">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </main>
  );
}
