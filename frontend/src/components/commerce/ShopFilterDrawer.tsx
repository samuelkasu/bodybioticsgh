"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { CloseIcon } from "@/components/ui/Icons";

/** Same timing as the side cart, so the two panels feel like one system. */
const SLIDE_MS = 300;

export type ShopFilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Phone and tablet filters. They used to expand in place above the grid, which
 * pushed the products a screen and a half down; as a panel they sit over the
 * page instead and the grid never moves.
 *
 * `mounted` keeps it in the tree while it slides back out, and `shown` drives
 * the transform a frame later — without that gap there is nothing to
 * transition from.
 */
export function ShopFilterDrawer({ isOpen, onClose, children }: ShopFilterDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  // Held in a ref so the listener effect below keys off `isOpen` alone: with
  // the callback in its deps, every parent render would tear the scroll lock
  // down and put it straight back.
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };

    // The panel is hidden from lg up, where the sidebar takes over. Closing on
    // the way there stops a resize from leaving the page scroll-locked behind
    // a panel that is no longer painted.
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => {
      if (wide.matches) closeRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWide);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className={`absolute inset-0 bg-black transition-opacity duration-[400ms] ${
          shown ? "opacity-25" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filter and sort"
        className={`bg-panel relative flex h-full w-full flex-col shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out sm:w-[350px] sm:max-w-[88%] ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="border-cocoa/15 flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-body font-bold text-[#222222]">Filter &amp; sort</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="focus-ring text-ink -mr-2 flex h-11 w-11 items-center justify-center"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="safe-bottom flex-1 overflow-y-auto overscroll-contain px-2 pt-2">
          {children}
        </div>
      </aside>
    </div>
  );
}
