import type { Metadata } from "next";

import { WishlistContents } from "@/components/commerce/WishlistContents";

export const metadata: Metadata = {
  title: "Wishlist",
  // Per-visitor, so there is nothing here for a crawler to index.
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <main className="max-w-shell mx-auto w-full flex-1 px-4 py-10 sm:px-6">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">Your wishlist</h1>
      <p className="mt-2 text-base text-neutral-600">
        Saved for later. Items stay here across devices once you sign in.
      </p>

      <div className="mt-8">
        <WishlistContents />
      </div>
    </main>
  );
}
