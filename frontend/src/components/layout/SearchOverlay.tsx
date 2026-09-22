"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmptySearchArt } from "@/components/ui/EmptySearchArt";
import { EmptyState } from "@/components/ui/Feedback";
import { CloseIcon, SearchIcon } from "@/components/ui/Icons";
import {
  useGetProductsQuery,
  useGetTagsQuery,
} from "@/lib/features/products/productsApi";
import type { Product, ProductTag } from "@/lib/features/products/types";
import { cn } from "@/lib/utils/cn";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";
import { formatMoney } from "@/lib/utils/money";

/** Long enough that a single stray letter does not fire a request. */
const MIN_QUERY = 2;

/** A pause, not a keystroke. Typing on 3G should not queue eight requests. */
const DEBOUNCE_MS = 300;

/** Six fits two rows of three on a phone and one row of six on a desktop. */
const SUGGESTION_COUNT = 6;

/** Two rows of chips at most; past that it stops being a shortlist. */
const POPULAR_COUNT = 8;

export type SearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Full-screen search.
 *
 * The old header search was a box and a button: type blind, press enter, land
 * on a results page. This opens onto something to act on — what other people
 * search for, and a handful of products — and then answers as you type, so the
 * common case of "I know roughly what I want" never needs the results page at
 * all.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced separately from the input's own value, so the field stays
  // instant while the request behind it waits for a pause.
  useEffect(() => {
    const trimmed = term.trim();
    const timer = setTimeout(() => setQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  // Opening a search panel and not putting the cursor in it costs a phone user
  // a second tap before the keyboard appears.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // The page behind must not scroll under the overlay — on iOS that is how a
  // customer loses their place in a long catalogue.
  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes from anywhere in the panel, not only from the input.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const isSearching = query.length >= MIN_QUERY;

  // Tag archives stand in for search analytics: they are the searches the shop
  // has already decided are worth a page, which is a better list than anything
  // guessed, and they cost nothing extra — the shop page loads the same query.
  const { data: tags } = useGetTagsQuery(undefined, { skip: !open });

  const { data: results, isFetching } = useGetProductsQuery(
    { search: query, perPage: SUGGESTION_COUNT },
    { skip: !open || !isSearching },
  );

  const { data: latest, isFetching: isLoadingLatest } = useGetProductsQuery(
    { perPage: SUGGESTION_COUNT, sort: "latest" },
    { skip: !open || isSearching },
  );

  if (!open) return null;

  const go = (destination: string) => {
    onClose();
    setTerm("");
    router.push(destination);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = term.trim();
    go(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : "/shop");
  };

  // Array.isArray rather than a plain optional chain: this is a whole-screen
  // overlay, and a malformed or proxied tag response should cost the customer
  // a row of chips, not the ability to search at all.
  const popular = Array.isArray(tags) ? tags.slice(0, POPULAR_COUNT) : [];
  const shown = isSearching ? (results?.items ?? []) : (latest?.items ?? []);
  const total = results?.total ?? 0;

  // Waiting and finding nothing are different things, and only one of them is
  // worth writing "nothing matches" about. Without the distinction the panel
  // greets every customer with a failure for the moment before the
  // recommendations arrive.
  const isLoadingTiles =
    shown.length === 0 && (isSearching ? isFetching : isLoadingLatest || !latest);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 overflow-y-auto bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <form
          role="search"
          onSubmit={onSubmit}
          className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white py-5"
        >
          <SearchIcon className="h-6 w-6 shrink-0 text-neutral-500" />
          <label className="sr-only" htmlFor="overlay-search">
            Search products
          </label>
          <input
            ref={inputRef}
            id="overlay-search"
            // Deliberately "text", not "search": a search input draws the
            // browser's own clear cross, which landed right beside this
            // panel's close cross — two identical marks an inch apart, one
            // emptying the box and one shutting the whole thing. The clear
            // below is ours, and it says what it does.
            type="text"
            inputMode="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="What are you looking for?"
            autoComplete="off"
            // No border and no button: the rule under the row is the field, and
            // the results below are the feedback. A "Search" button here would
            // only take people to a page they no longer need.
            className="text-ink min-w-0 flex-1 bg-transparent text-xl outline-none placeholder:text-neutral-400 sm:text-2xl"
          />

          {term.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                inputRef.current?.focus();
              }}
              className="focus-ring text-taupe hover:text-ink hidden shrink-0 rounded-lg px-2 py-1 text-sm underline-offset-4 hover:underline sm:block"
            >
              Clear
            </button>
          )}

          <span aria-hidden="true" className="hidden h-6 w-px bg-neutral-200 sm:block" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="focus-ring text-ink bg-panel hover:bg-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </form>

        {!isSearching && popular.length > 0 && (
          <section aria-labelledby="popular-heading" className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="popular-heading" className="text-ink text-lg font-semibold">
                Most frequently searched
              </h2>
              <Link
                href="/shop"
                onClick={onClose}
                className="focus-ring hover:text-ink shrink-0 text-sm text-neutral-500"
              >
                View more
              </Link>
            </div>

            <PopularChips tags={popular} onNavigate={onClose} className="mt-4" />
          </section>
        )}

        <section aria-labelledby="suggestions-heading" className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="suggestions-heading" className="text-ink text-lg font-semibold">
              {isSearching ? "Results" : "Recommendations"}
            </h2>

            {isSearching && total > shown.length && (
              <Link
                href={`/shop?q=${encodeURIComponent(query)}`}
                onClick={onClose}
                className="focus-ring hover:text-ink shrink-0 text-sm text-neutral-500"
              >
                See all {total}
              </Link>
            )}
          </div>

          {isLoadingTiles ? (
            <ul
              role="status"
              aria-label="Loading products"
              className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
            >
              {Array.from({ length: SUGGESTION_COUNT }, (_, index) => (
                <li key={index}>
                  <div className="bg-panel aspect-square animate-pulse rounded-lg" />
                  <div className="mt-2 h-4 animate-pulse rounded bg-neutral-100" />
                </li>
              ))}
            </ul>
          ) : shown.length === 0 ? (
            // Only ever shown for a search that actually ran. The same jars and
            // lens the shop page uses for an empty result, so a dead end looks
            // like part of the shop rather than a browser error — and it hands
            // back the popular searches, because the way out of "no results" is
            // another search, not a paragraph.
            isSearching && (
              <div className="mt-4">
                <EmptyState
                  title={`Nothing matches “${query}”`}
                  description="Try a shorter word, or the brand name on the bottle."
                  art={<EmptySearchArt className="h-32 w-auto sm:h-40" />}
                  action={
                    <Link
                      href="/shop"
                      onClick={onClose}
                      className="focus-ring bg-ink hover:bg-cocoa rounded-card inline-flex min-h-11 items-center px-5 text-sm font-medium text-white no-underline transition-colors hover:no-underline"
                    >
                      Browse the whole shop
                    </Link>
                  }
                />

                {popular.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-center text-sm text-neutral-500">
                      Or try one of these
                    </h3>
                    <PopularChips
                      tags={popular}
                      onNavigate={onClose}
                      className="mt-3 justify-center"
                    />
                  </div>
                )}
              </div>
            )
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {shown.map((product) => (
                <li key={product.id}>
                  <SuggestionTile product={product} onNavigate={onClose} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * The tag archives, as tappable chips. Shared between the resting panel and
 * the empty result, where they are the way out of a dead end.
 */
function PopularChips({
  tags,
  onNavigate,
  className,
}: {
  tags: ProductTag[];
  onNavigate: () => void;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-3", className)}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            href={`/product-tag/${tag.slug}`}
            onClick={onNavigate}
            className="focus-ring bg-panel text-ink hover:bg-sand border-card-line/70 flex min-h-11 items-center rounded-lg border px-4 text-sm no-underline transition-colors hover:no-underline"
          >
            {tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * A product at suggestion size: photo, name, price. Deliberately not the full
 * ProductCard — no add-to-cart, no wishlist heart. This is a way through to a
 * product, and a second row of controls inside a search panel is noise.
 */
function SuggestionTile({
  product,
  onNavigate,
}: {
  product: Product;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={`/product/${product.slug}`}
      onClick={onNavigate}
      className="focus-ring group block no-underline hover:no-underline"
    >
      <div className="bg-panel relative aspect-square overflow-hidden rounded-lg">
        <Image
          src={product.imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          loading="lazy"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
        />

        {/* The badge Oraimo uses for "New Arrival", carrying the thing our
            catalogue actually knows: what a customer saves right now. */}
        {product.discountPercent !== null && product.discountPercent > 0 && (
          <span className="bg-olive text-micro absolute top-2 right-2 rounded px-1.5 py-0.5 font-semibold text-white">
            <span className="sr-only">Save </span>
            {product.discountPercent}% off
          </span>
        )}
      </div>

      <p className="text-ink mt-2 line-clamp-2 text-sm">{product.name}</p>
      <p className="mt-0.5 text-sm font-medium text-neutral-600 tabular-nums">
        {formatMoney(product.priceMinor, product.currency)}
      </p>
    </Link>
  );
}
