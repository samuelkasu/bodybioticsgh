"use client";

import { useEffect, useState } from "react";

import { ChevronRightIcon } from "@/components/ui/Icons";

/** Roughly one screen down, so it never appears on a page you can already see. */
const SHOW_AFTER_PX = 700;

/**
 * Appears once the page has been scrolled and takes you back to the top.
 *
 * Bottom right, clear of everything else that lives down there: the cookie
 * sheet opens centred on a phone and bottom left on a desktop, and the toaster
 * is centred. It sits at z-45, which is above the product page's sticky
 * add-to-cart bar but under the prompts and toasts, and the extra bottom
 * offset on a phone keeps it off that bar entirely rather than over the top
 * of its buttons.
 */
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const sync = () => setShown(window.scrollY > SHOW_AFTER_PX);

    // Deep-linked or restored halfway down the page: decide before the first
    // scroll event rather than after it.
    sync();

    // passive: this must never be able to hold up a scroll.
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  if (!shown) return null;

  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
      aria-label="Back to top"
      className="focus-ring bg-ink/85 hover:bg-ink fixed right-4 bottom-20 z-[45] grid h-12 w-12 place-items-center rounded-full text-white shadow-lg backdrop-blur-sm transition-colors sm:right-6 sm:bottom-6"
    >
      {/* The chevron set only points left and right; turned a quarter turn it
          is the up arrow this needs, and that beats a tenth glyph in Icons. */}
      <ChevronRightIcon className="h-6 w-6 -rotate-90" />
    </button>
  );
}
