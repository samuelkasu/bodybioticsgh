import Image from "next/image";
import Link from "next/link";

/**
 * The original hero is a single artwork with its headline set into the image
 * ("Radiant / Skin care routine through Holistic health, and self-care
 * approach." over the models and bottles). It ships in two crops — a wide one
 * for desktop and a taller one for phones — so both are used here rather than
 * squashing one into the other.
 *
 * The visible words live in the artwork, so the real <h1> is screen-reader
 * only; without it the page would have no heading at all.
 */
export function Hero() {
  return (
    <section className="bg-cream relative">
      <h1 className="sr-only">
        Radiant — skin care routine through holistic health and a self-care approach
      </h1>

      <Link href="/shop" className="focus-ring block" aria-label="Shop now">
        <picture>
          <source media="(min-width: 768px)" srcSet="/brand/hero-wide.webp" />
          <Image
            src="/brand/hero-tall.webp"
            alt="Three women with Body Biotics body care products"
            width={1600}
            height={1100}
            priority
            sizes="100vw"
            className="h-auto w-full"
          />
        </picture>
      </Link>
    </section>
  );
}
