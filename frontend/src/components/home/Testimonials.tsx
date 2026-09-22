import Image from "next/image";
import Link from "next/link";

import { PhotoSlideshow } from "@/components/home/PhotoSlideshow";
import { Reveal } from "@/components/ui/Reveal";

/** The four photos the original cycles behind this panel, in its order. */
const REVIEW_PHOTOS = [
  "/assets/beautiful-trendy-woman-with-eye-patches-isolated-2024-11-19-06-29-33-utc-1.jpg",
  "/assets/a-womans-beauty-unveiled-by-natures-grace-BDU27LV.jpg",
  "/assets/dgefwef.jpg",
  "/assets/elegant-woman-showcasing-skincare-routine-highlig-2024-11-17-02-45-30-utc-1.jpg",
];

/** Quotes, names and roles copied verbatim from the original storefront. */
const TESTIMONIALS = [
  {
    name: "Amaka",
    role: "Happy Customer",
    avatar: "/brand/avatars-amaka.webp",
    lead: "Bodybiotics",
    quote:
      " skin care products are excellent for daily use, delivering great quality and effectiveness that I depend on for my skin care routine.",
  },
  {
    name: "Charity",
    role: "Happy Customer",
    avatar: "/brand/avatars-charity.webp",
    quote:
      "My skin feels normal again, and I really like these products. They have changed my skincare routine and my skin feels refreshed.",
  },
  {
    name: "Caroline",
    role: "Happy Customer",
    avatar: "/brand/avatars-caroline.webp",
    quote:
      "These awesome creams have totally boosted my skincare game, giving me that amazing confidence and excitement I always knew I could have!",
  },
  {
    name: "Freda",
    role: "Happy Customer",
    avatar: "/brand/avatars-freda.webp",
    quote:
      "I feel more confident about my skin now, thanks to my new skin care products that have improved my appearance and self-image.",
  },
];

/**
 * Photo card on the left with the store blurb and a white pill overlaid on it,
 * four sand quote cards on the right — the arrangement the original uses.
 */
export function Testimonials() {
  return (
    <section
      aria-labelledby="reviews-heading"
      className="bg-cream defer-paint px-4 pt-14 pb-16 sm:px-6 lg:pt-20"
    >
      <div className="mx-auto w-full max-w-7xl">
        <Reveal>
          <p className="eyebrow">Customer reviews</p>
          <h2 id="reviews-heading" className="text-display-md mt-3 max-w-2xl">
            Your Skin, Your Routine, Your Worthy Glow.
          </h2>
        </Reveal>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
          <Reveal
            animation="left"
            className="relative min-h-[460px] overflow-hidden rounded-2xl sm:min-h-[560px] lg:min-h-0"
          >
            <PhotoSlideshow
              images={REVIEW_PHOTOS}
              alt="Customers with healthy, radiant skin"
              sizes="(max-width: 1024px) 100vw, 420px"
            />

            {/* Blurred panel sitting on the photo, as on the original. */}
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/35 p-5 backdrop-blur-sm">
              <p className="text-meta leading-relaxed text-white">
                <strong className="font-semibold">Body Biotics</strong> provides
                high-quality personal care, wellness, and intimacy products that support
                beauty, body confidence, and holistic well-being.
              </p>

              <Link
                href="/shop"
                className="focus-ring text-ink mt-5 inline-flex min-h-14 items-center gap-3 rounded-full bg-white px-8 text-base font-medium hover:no-underline"
              >
                Visit Store
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          </Reveal>

          <ul className="grid gap-5 sm:grid-cols-2">
            {TESTIMONIALS.map((testimonial, index) => (
              <Reveal
                as="li"
                key={testimonial.name}
                delay={index * 110}
                className="bg-sand/70 card-hover flex h-full flex-col rounded-2xl p-6"
              >
                <blockquote className="text-cocoa-deep text-body flex-1 leading-relaxed">
                  {testimonial.lead && (
                    <strong className="font-semibold">{testimonial.lead}</strong>
                  )}
                  {testimonial.quote}
                </blockquote>

                <figcaption className="mt-5 flex items-center gap-3">
                  <Image
                    src={testimonial.avatar}
                    alt=""
                    width={160}
                    height={160}
                    sizes="48px"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <span>
                    <span className="font-display text-ink block text-lg font-semibold">
                      {testimonial.name}
                    </span>
                    <span className="text-cocoa block text-sm">{testimonial.role}</span>
                  </span>
                </figcaption>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
