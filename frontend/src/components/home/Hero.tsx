import Link from "next/link";

import { PhotoSlideshow } from "@/components/home/PhotoSlideshow";
import { site } from "@/lib/site";

/**
 * Full-bleed opening panel: a photo that changes on its own, the headline, two
 * calls to action and the promise in the corner.
 *
 * The photos rotate rather than sitting on one frame, which is what the design
 * asks for and also hides the fact that no single shot carries the whole
 * width well on both a phone and a desktop. PhotoSlideshow already does the
 * cross-fade, the Ken Burns drift and the reduced-motion opt-out, so this file
 * only decides which photos and how long each holds.
 */
/**
 * Cropped for this panel rather than used as shot. The originals in
 * public/assets are tall studio portraits; dropped into a wide band and left
 * to object-cover they lose their subjects' mouths and chins, which reads as
 * an accident rather than a close-up. Each of these is an explicit crop that
 * keeps the faces whole at the band's proportions.
 *
 * Three, not five. Two more were tried and dropped: their originals were
 * 612x323 and 563x360, and upscaling interpolates rather than recovering
 * detail, so they sat visibly soft next to these. A slide only belongs here
 * if its source is 1600px wide, which is as far as the photography goes.
 */
const SLIDES = ["/brand/hero-1.webp", "/brand/hero-2.webp", "/brand/hero-3.webp"];

/**
 * Pill and outline, not the rounded rectangles Button enforces elsewhere, and
 * light rather than ink: these sit on photography, not on the cream page, and
 * Button's variants are all built for the latter. Kept local so the shared
 * component's brand rule stays intact for every other screen.
 */
const CTA_BASE =
  "focus-ring inline-flex min-h-12 items-center justify-center rounded-full px-8 text-base font-medium no-underline transition-colors hover:no-underline";

export function Hero() {
  return (
    // Not 100svh: the announcement bar and the header sit above this in the
    // flow rather than over it, so a full-viewport panel would push the
    // headline's own buttons below the fold on a phone.
    <section className="relative isolate flex min-h-[78svh] flex-col justify-end overflow-hidden bg-[#2b2019]">
      <PhotoSlideshow
        images={SLIDES}
        alt="Women wearing Body Biotics skincare"
        sizes="100vw"
        intervalMs={6000}
        // The source photography tops out at 1600px, so the optimizer cannot
        // add resolution back; what it can stop doing is throwing away the
        // detail that is there. At the default 75 these came out soft and
        // blocky across the cheeks and the flat studio backdrops.
        quality={90}
        drift="gentle"
        className="-z-20"
      />

      {/*
        Two washes, not one. The vertical one darkens the lower half the copy
        sits in; the diagonal deepens the left, where the headline runs longest.
        Both are needed because the slides are bright studio shots on warm
        backgrounds — a single overlay dark enough to carry white text over a
        lit cheek flattens the photograph everywhere else.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/45 to-black/15"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-r from-black/65 via-black/20 to-transparent"
      />

      <div className="max-w-shell mx-auto grid w-full gap-8 px-4 pt-44 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-12 lg:pt-32 lg:pb-16">
        <div>
          <h1 className="font-display text-display-lg sm:text-display-xl max-w-[14ch] text-[#f4ece3]">
            Elevate your Skin tone.
          </h1>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className={`${CTA_BASE} text-ink bg-[#f4ece3] hover:bg-white`}
            >
              Visit Our Store
            </Link>
            <Link
              href="/contact"
              className={`${CTA_BASE} border border-white/70 text-white hover:bg-white/15`}
            >
              Make Inquiries
            </Link>
          </div>
        </div>

        {/* The promise, bottom right on a desktop and under the buttons on a
            phone, where a second column would squeeze both to nothing. */}
        <p className="text-lg leading-relaxed text-white/90 lg:text-right">
          {site.description}
        </p>
      </div>
    </section>
  );
}
