import Image from "next/image";
import Link from "next/link";

import { HeroVideo } from "@/components/home/HeroVideo";
import { PhotoSlideshow } from "@/components/home/PhotoSlideshow";
import { StarRating } from "@/components/commerce/StarRating";
import { site } from "@/lib/site";

/**
 * Full-bleed opening panel: a photo that changes on its own, the store rating
 * over it, the headline, two calls to action and the promise in the corner.
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
 */
const SLIDES = ["/brand/hero-1.webp", "/brand/hero-2.webp", "/brand/hero-3.webp"];

/** Four are on file; three read as a group without crowding the pill. */
const RATED_BY = [
  { src: "/brand/avatars-amaka.webp", alt: "" },
  { src: "/brand/avatars-caroline.webp", alt: "" },
  { src: "/brand/avatars-charity.webp", alt: "" },
];

const STORE_RATING = 4.7;

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

      {/* Dead centre on a desktop, as the design has it. On a phone the copy
          below is tall enough to reach the middle of the panel, so the control
          is confined to the upper half where it cannot land on the headline. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 grid h-[55%] place-items-center lg:h-full">
        <div className="pointer-events-auto">
          <HeroVideo src="/brand/skincare.mp4" label="Play the Body Biotics film" />
        </div>
      </div>

      <div className="max-w-shell mx-auto grid w-full gap-8 px-4 pt-44 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-12 lg:pt-32 lg:pb-16">
        <div>
          <p className="inline-flex items-center gap-3 rounded-full bg-black/35 py-2 pr-5 pl-2 backdrop-blur-sm">
            <span className="flex -space-x-2">
              {RATED_BY.map((face) => (
                <Image
                  key={face.src}
                  src={face.src}
                  alt={face.alt}
                  width={160}
                  height={160}
                  sizes="32px"
                  className="h-8 w-8 rounded-full border-2 border-white/80 object-cover"
                />
              ))}
            </span>

            <span className="flex flex-col leading-tight">
              <StarRating value={STORE_RATING} />
              <span className="text-caption font-medium text-white/90">
                {STORE_RATING} Store Ratings
              </span>
            </span>
          </p>

          <h1 className="font-display text-display-lg sm:text-display-xl mt-6 max-w-[14ch] text-[#f4ece3]">
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
