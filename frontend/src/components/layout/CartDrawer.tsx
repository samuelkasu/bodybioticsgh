"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CartLines } from "@/components/commerce/CartLines";
import { PriceTag } from "@/components/commerce/PriceTag";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/Icons";
import {
  cartToggled,
  selectCartCurrency,
  selectCartItemCount,
  selectCartSubtotalMinor,
  selectIsCartOpen,
} from "@/lib/features/cart/cartSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

/** Matches the original's side cart: 0.3s panel, 0.4s scrim. */
const SLIDE_MS = 300;

/**
 * Side cart, with the original's values: a 350px #E9E1D9 panel that slides in
 * from the right over a 25% black scrim, 20px/30px padding and a bare close
 * button — no title bar.
 */
export function CartDrawer() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const isOpen = useAppSelector(selectIsCartOpen);
  const itemCount = useAppSelector(selectCartItemCount);
  const subtotalMinor = useAppSelector(selectCartSubtotalMinor);
  const currency = useAppSelector(selectCartCurrency);

  // `mounted` keeps the panel in the tree while it slides back out; `shown`
  // drives the transform, and has to flip a frame after mounting or the
  // browser has nothing to transition from.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => dispatch(cartToggled(false));

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      if (isOpen) {
        setMounted(true);
        inner = requestAnimationFrame(() => setShown(true));
      } else {
        setShown(false);
      }
    });
    const timer = isOpen ? undefined : setTimeout(() => setMounted(false), SLIDE_MS);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Where focus was before the drawer took it, so it can be handed back.
    // Without this a keyboard user closes the cart and lands at the top of the
    // document, having lost the product they were on.
    const opener = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch(cartToggled(false));
        return;
      }

      if (event.key !== "Tab") return;

      // aria-modal is a promise to assistive tech that the rest of the page is
      // unreachable. Tab has to be held inside the panel or that promise is a
      // lie: focus walks out behind the scrim onto controls nobody can see.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    // Stops the page behind from scrolling under the drawer on iOS.
    document.body.style.overflow = "hidden";

    // Captured now rather than read in the cleanup: by the time cleanup runs
    // React may already have detached the node and cleared the ref, and the
    // check below would then never fire.
    const panel = panelRef.current;

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      // Only if focus is still inside the drawer being unmounted; a customer
      // who clicked "Checkout" is already on another page and must not be
      // yanked back to the basket icon.
      if (opener?.isConnected && panel?.contains(document.activeElement)) {
        opener.focus();
      }
    };
  }, [dispatch, isOpen]);

  // Moved once the panel has slid in, onto the close button: it is the control
  // a customer who opened this by accident wants, and it is a safe landing
  // spot that does not change anything.
  useEffect(() => {
    if (!shown) return;
    closeRef.current?.focus();
  }, [shown]);

  // Navigating away (to the cart or checkout page) should dismiss it.
  useEffect(() => {
    dispatch(cartToggled(false));
  }, [dispatch, pathname]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        // Hidden from the tab order and from assistive tech: the panel has a
        // real close button, and a second one here would be a stop on the way
        // out of a trap that deliberately has no way out.
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 bg-black transition-opacity duration-[400ms] ${
          shown ? "opacity-25" : "opacity-0"
        }`}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={`relative flex h-full w-[350px] max-w-full flex-col bg-[#e9e1d9] px-8 py-5 shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="focus-ring text-ink -mr-2 flex h-11 w-11 items-center justify-center"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <h2 className="sr-only">Your cart ({itemCount})</h2>

        <div className="flex-1 overflow-y-auto">
          {itemCount === 0 ? (
            // Not just a statement of fact: an empty drawer with no way out of
            // it is a dead end the customer has to close and navigate around.
            <div className="pt-2">
              <p className="text-ink text-base">No products in the cart yet.</p>
              <Link href="/shop" onClick={close} className="focus-ring mt-4 block">
                <Button fullWidth>Start shopping</Button>
              </Link>
            </div>
          ) : (
            <CartLines compact />
          )}
        </div>

        {itemCount > 0 && (
          <footer className="safe-bottom border-cocoa/15 mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-cocoa text-sm">Subtotal</span>
              <PriceTag amountMinor={subtotalMinor} currency={currency} size="lg" />
            </div>

            <div className="mt-3 grid gap-2">
              <Link href="/checkout" className="focus-ring">
                <Button fullWidth size="lg">
                  Checkout
                </Button>
              </Link>
              <Link href="/cart" className="focus-ring">
                <Button variant="outline" fullWidth>
                  View cart
                </Button>
              </Link>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
