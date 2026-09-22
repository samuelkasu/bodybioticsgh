"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { site } from "@/lib/site";

/** Long enough that the fill reads as deliberate, short enough not to stall. */
const MIN_HOLD_MS = 600;

/**
 * Hard cap. A splash that outlives a stalled image or a hanging request is
 * worse than no splash, so readiness can delay the exit but never own it.
 */
const MAX_HOLD_MS = 6000;

export type SplashProps = {
  /**
   * Route transitions render this as a Suspense fallback, where React removes
   * it the moment the segment is ready. Dismissing itself there would uncover
   * a blank page, so it stays put and lets the boundary do the swap.
   */
  persistent?: boolean;
};

/**
 * Warm greige preloader, as the original storefront shows while it boots. It
 * doubles as the PWA's launch screen.
 *
 * The mark sits at 30% opacity with a full-strength copy revealed over it from
 * the bottom up, which is how the original's loader fills (LoftLoader's
 * "imgloading": a bottom-anchored box whose height animates 0 → 100%).
 *
 * It is server-rendered, so it is in the first HTML the browser paints and
 * never flashes in late. It leaves once the page has finished loading — window
 * `load`, so fonts and the first screen of photos are in — rather than on a
 * blind timer, which is what made content pop in behind a splash that had
 * already gone.
 */
export function Splash({ persistent = false }: SplashProps) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (persistent) return;

    const startedAt = Date.now();
    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const leave = () => {
      // Elapsed, not a fixed delay: a page that was ready in 50ms still gets
      // the full hold, one that took 2s leaves immediately.
      const remaining = Math.max(0, MIN_HOLD_MS - (Date.now() - startedAt));
      holdTimer = setTimeout(() => setLeaving(true), remaining);
    };

    // Hydration can land after load has already fired; there is no event left
    // to wait for in that case.
    if (document.readyState === "complete") {
      leave();
    } else {
      window.addEventListener("load", leave, { once: true });
    }

    const cap = setTimeout(leave, MAX_HOLD_MS);

    return () => {
      window.removeEventListener("load", leave);
      clearTimeout(cap);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [persistent]);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      data-leaving={leaving ? "true" : "false"}
      // The fill animation bubbles up here too, hence the name check.
      onAnimationEnd={(event) => {
        if (event.animationName.includes("splash-out")) setGone(true);
      }}
      className="splash fixed inset-0 z-[100] grid place-items-center bg-[#e5d7c7]"
    >
      <div className="relative w-[252px] max-w-[90vw]">
        <Image
          src="/brand/logo-dark.webp"
          alt=""
          width={520}
          height={164}
          priority
          // The container is 252px wide and capped at 90vw. Without `sizes`,
          // next/image assumes the image could be full-width and picks a
          // 1200px file — 28KB, for a mark that is never drawn above 252 CSS
          // px, and it is the largest paint on every page because the splash
          // covers the viewport until load. Naming the real box makes the
          // browser take a file a fraction of the size.
          sizes="252px"
          className="block w-full opacity-30"
        />

        {/* WebP, not the PNG: the fill is a CSS background, so it is fetched
            raw rather than through the optimizer, and the splash is on every
            page — 45KB down to 28KB on every first load. The <Image> above
            points at the same file so the two share one request budget. */}
        {/* Grows upward; `cover` keeps the mark at its natural size inside it,
            anchored to the bottom, so the fill line climbs the logo. It cycles
            rather than settling, because the wait is now open-ended. */}
        <span className="splash-fill absolute bottom-0 left-0 block w-full overflow-hidden">
          <span className="block h-full w-full bg-[url('/brand/logo-dark.webp')] bg-cover bg-bottom bg-no-repeat" />
        </span>
      </div>

      <span className="sr-only">Loading {site.name}</span>

      {/* Without JS nothing ever fires `load` for us to listen to, so the
          splash falls back to leaving on its own. */}
      <noscript>
        <style>{`.splash{animation:splash-out .45s ease .75s forwards}`}</style>
      </noscript>
    </div>
  );
}
