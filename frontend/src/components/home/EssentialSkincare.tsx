import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { JarIcon, LeafIcon } from "@/components/ui/Icons";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

const CARDS = [
  {
    title: "Essential Products",
    body: "We offer a wide range of high-quality skin care products that are carefully formulated to meet your unique skincare needs.",
    Icon: JarIcon,
    tile: "bg-blush",
  },
  {
    title: "Holistic Body Care",
    body: "Body Biotics offers premium personal care and wellness products to enhance your beauty, boost confidence, and promote well-being.",
    Icon: LeafIcon,
    // The original tints the second tile cool against the first one's blush.
    tile: "bg-mist/45",
  },
];

/** Copy block on the left, two bordered feature cards on the right, wide photo below. */
export function EssentialSkincare() {
  return (
    <section
      aria-labelledby="essential-heading"
      className="bg-cream-deep px-4 py-14 sm:px-6 lg:py-20"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            <p className="eyebrow text-ink/75">Essential Skincare</p>
            <h2 id="essential-heading" className="text-display-md mt-3">
              Your Skin, Your Power, Your Radiant Confidence.
            </h2>
            <p className="text-cocoa mt-4 max-w-[34rem] text-sm leading-relaxed sm:text-base">
              Discover a skin care routine that’s not just a great way to invest your time
              and energy, but also has the amazing potential to boost your appearance and
              overall wellness, helping you shine with a healthier and more radiant glow!
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="focus-ring">
                <Button size="lg" className="rounded-full px-8">
                  See All Latest
                </Button>
              </Link>
              <a href={site.contact.whatsapp} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-taupe-soft/45 rounded-full px-8"
                >
                  Consultation
                </Button>
              </a>
            </div>
          </Reveal>

          <ul className="grid gap-5 sm:grid-cols-2 lg:self-start">
            {CARDS.map(({ title, body, Icon, tile }, index) => (
              <Reveal
                as="li"
                key={title}
                delay={index * 150}
                className="border-sand/70 rounded-2xl border bg-white/50 p-6"
              >
                <span
                  className={`text-cocoa-deep flex h-14 w-14 items-center justify-center rounded-xl ${tile}`}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
                <p className="text-cocoa text-meta mt-3 leading-relaxed">{body}</p>
              </Reveal>
            ))}
          </ul>
        </div>

        {/*
          The original pins this band: the photo is a fixed-attachment
          background, so the section scrolls over it like a window rather than
          carrying it along. Its metrics come straight from that page —
          45px above, a 21px radius, 399/466/607px tall as the viewport grows.
          Below md it scrolls normally; iOS ignores `fixed` anyway and a
          half-working parallax reads as a bug.
        */}
        <div
          role="img"
          aria-label="Three women using Body Biotics skincare products"
          className="essential-band rounded-pill mt-11 min-h-[399px] bg-cover bg-center bg-no-repeat md:bg-fixed lg:min-h-[466px] xl:min-h-[607px]"
        />
      </div>
    </section>
  );
}
