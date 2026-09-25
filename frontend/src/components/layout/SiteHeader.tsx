"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import {
  BagIcon,
  CloseIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { useGetCartQuery } from "@/lib/features/cart/cartApi";
import { cartToggled, selectCartItemCount } from "@/lib/features/cart/cartSlice";
import { useGetWishlistQuery } from "@/lib/features/wishlist/wishlistApi";
import { site } from "@/lib/site";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Near-black bar with a blurred tint over it, matching the original's header:
 * a #000000EB base, warm taupe (#8B745B8C) on the home page and a faint black
 * (#00000021) everywhere else, both over blur(4.5px).
 *
 * It scrolls away with the page rather than sticking — the original's header
 * is `position: static` on every template.
 *
 * On the home page it is transparent and sits over the hero instead. That is
 * the one place it can be: the hero is a full-bleed photograph with its own
 * dark wash, so the bar has something to be legible against. Everywhere else
 * the page starts on cream and white nav links would disappear.
 *
 * Because the header does not stick, "over the hero" is the only state it
 * ever has there — scroll and it leaves with the photograph. No second,
 * solid-on-scroll variant is needed, and none is worth the scroll listener.
 */
export function SiteHeader() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const itemCount = useAppSelector(selectCartItemCount);
  // Shares its cache with every product card's heart, so this costs no extra
  // request on a catalogue page.
  const { data: wishlist } = useGetWishlistQuery();
  const wishlistCount = wishlist?.count ?? 0;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Pulls the server cart once per mount so a returning visitor sees the
  // basket they left on another device.
  useGetCartQuery();

  const isHome = pathname === "/";
  // Over the hero the panels have a photograph behind them, not a solid bar,
  // so they need most of the way to opaque to stay readable.
  const panelTone = isHome ? "bg-cocoa-deep/95" : "bg-black/70";

  return (
    <header
      className={cn(
        "relative z-40",
        // -mb-20 pulls the hero up under the bar without taking the header out
        // of the flow, so it still scrolls away and still pushes nothing else
        // around. 5rem is the height the padding below is built to hold.
        isHome ? "-mb-20" : "bg-[#000000eb]",
      )}
    >
      {/* The tint the original lays over the bar: warm on home, neutral
          elsewhere. On home it is a flat wash with a hard bottom edge, not a
          gradient — the bar should read as a bar that the photograph shows
          through, which is what a fade to nothing loses. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 backdrop-blur-[4.5px]",
          isHome ? "bg-cocoa-deep/58" : "bg-black/[0.10]",
        )}
      />

      {/* Padding pairs with the logo height below to hold the bar at 80px. */}
      <div className="relative mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-[1.125rem] sm:px-6 sm:py-3">
        <button
          type="button"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="focus-ring -ml-1 flex h-11 w-11 items-center justify-center rounded-full text-white lg:hidden"
        >
          {isMenuOpen ? (
            <CloseIcon className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>

        <Link href="/" className="focus-ring flex items-center" aria-label={site.name}>
          <Image
            src="/brand/logo-light.png"
            alt={site.name}
            width={600}
            height={180}
            priority
            className="h-11 w-auto sm:h-14"
          />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-7 lg:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="focus-ring nav-underline text-meta tracking-label font-bold text-white uppercase transition-opacity hover:opacity-80"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-6 lg:border-l lg:border-white/30 lg:pl-5">
          <Link
            href="/account"
            aria-label="Account"
            className="focus-ring hidden h-11 w-11 items-center justify-center rounded-full text-white sm:flex"
          >
            <UserIcon className="h-6 w-6" />
          </Link>

          <Link
            href="/wishlist"
            aria-label={
              wishlistCount > 0
                ? `Wishlist, ${wishlistCount} item${wishlistCount === 1 ? "" : "s"}`
                : "Wishlist"
            }
            className="focus-ring relative hidden h-11 w-11 items-center justify-center rounded-full text-white sm:flex"
          >
            <HeartIcon className="h-6 w-6" />
            {wishlistCount > 0 && (
              <span className="text-micro absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 font-semibold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>

          <button
            ref={searchButtonRef}
            type="button"
            aria-label="Search products"
            aria-expanded={isSearchOpen}
            aria-haspopup="dialog"
            onClick={() => setIsSearchOpen((open) => !open)}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-white"
          >
            <SearchIcon className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => dispatch(cartToggled(true))}
            className="focus-ring relative flex h-11 w-11 items-center justify-center rounded-full text-white"
            aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
          >
            <BagIcon className="h-6 w-6" />
            {itemCount > 0 && (
              <span className="text-micro absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 font-semibold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <SearchOverlay
        open={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          // Focus goes back to the control that opened it, not to the top of
          // the document — a keyboard user should not have to tab back in.
          searchButtonRef.current?.focus();
        }}
      />

      {isMenuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className={cn(
            "relative border-t border-white/20 px-4 pb-3 backdrop-blur-md lg:hidden",
            panelTone,
          )}
        >
          <ul className="divide-y divide-white/15">
            {[...site.nav, { href: "/account", label: "My account" }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="focus-ring flex min-h-12 items-center text-sm font-semibold tracking-wide text-white uppercase"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
