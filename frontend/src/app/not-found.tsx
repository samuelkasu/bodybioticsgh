import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  // A 404 that ranks is worse than no 404 at all.
  robots: { index: false, follow: true },
};

// `no-underline hover:no-underline` because globals.css underlines every anchor
// on hover. That is right for a link in a sentence and wrong for something
// shaped like a button.
const ACTION =
  "focus-ring inline-flex min-h-12 items-center justify-center rounded-card px-6 text-base font-medium no-underline transition-colors duration-200 hover:no-underline";

/**
 * Deliberately outside the (shop) route group, so it renders with no header,
 * no footer and no cart drawer. Someone who lands here followed a dead link —
 * usually a product URL from the old WooCommerce site — and one clear page with
 * a way back beats a full storefront wrapped around an apology.
 */
export default function NotFound() {
  return (
    <main className="bg-cream flex min-h-dvh flex-1 flex-col items-center justify-center text-center">
      {/*
        The artwork carries the "404", so there is no separate label above the
        heading — it would only say the same thing twice. It is transparent, so
        the cream page shows through rather than sitting in a white box.
      */}
      <Image
        src="/404.png"
        alt=""
        width={1853}
        height={822}
        // The largest thing on the page and the first paint, so it is not lazy.
        priority
        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 70vw, 720px"
        className="h-auto w-full max-w-[720px]"
      />

      {/* font-sans overrides the serif that globals.css gives every h1. */}
      <h1 className="text-ink mt-6 font-sans text-3xl font-semibold sm:mt-8 sm:text-4xl">
        We could not find that page
      </h1>

      <p className="text-taupe-soft mt-3 max-w-md font-sans text-base">
        The link may be out of date, or the product may have sold out and been retired.
        Everything we currently stock is in the shop.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 font-sans sm:w-auto sm:flex-row">
        <Link href="/shop" className={`${ACTION} bg-ink hover:bg-cocoa text-white`}>
          Browse the shop
        </Link>
        <Link
          href="/"
          className={`${ACTION} border-ink text-ink hover:bg-ink border hover:text-white`}
        >
          Go home
        </Link>
      </div>

      <p className="text-taupe-soft mt-10 font-sans text-sm">
        Looking for something specific?{" "}
        <a
          href={site.contact.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring text-ink underline underline-offset-4"
        >
          Message us on WhatsApp
        </a>{" "}
        and we will find it for you.
      </p>
    </main>
  );
}
