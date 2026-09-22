import { AmbientVideo } from "@/components/home/AmbientVideo";
import {
  HalfStarIcon,
  HeartIcon,
  JarIcon,
  ShippingIcon,
  StarIcon,
} from "@/components/ui/Icons";
import { Reveal } from "@/components/ui/Reveal";

const FEATURES = [
  { title: "Fast & reliable shipping", Icon: ShippingIcon },
  { title: "Outstanding quality product", Icon: JarIcon },
  { title: "Better customer care service", Icon: HeartIcon },
];

/**
 * Full-bleed video of a skincare close-up with translucent sand cards over it,
 * as on the original. The video is 17MB, so phones get the poster frame only —
 * autoplaying that over mobile data would be indefensible.
 *
 * `hidden md:block` was not enough to make that true — see AmbientVideo, which
 * is where the breakpoint is actually enforced. Desktop is unchanged.
 */
export function WhyChoose() {
  return (
    <section
      aria-labelledby="why-heading"
      className="bg-cocoa-deep defer-paint relative flex min-h-[100svh] items-end overflow-hidden"
    >
      <AmbientVideo
        src="/brand/skincare.mp4"
        poster="/brand/why-choose-poster.webp"
        className="absolute inset-0 hidden h-full w-full object-cover md:block"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/brand/why-choose-poster.webp')] bg-cover bg-center md:hidden"
      />
      {/* Keeps the cards readable whatever frame the video is on. */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/45" />

      <div className="relative mx-auto grid w-full max-w-7xl items-stretch gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,24rem)_1fr] lg:pb-16">
        <Reveal
          animation="left"
          className="rounded-2xl bg-[linear-gradient(155deg,rgba(8,5,4,0.94),rgba(48,31,23,0.55))] p-6 text-center sm:p-8"
        >
          <p className="relative inline-block pl-4 text-5xl leading-none font-bold text-white sm:text-6xl">
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 left-0 w-px bg-white/45"
            />
            4.7+
          </p>
          <h2
            id="why-heading"
            className="text-sand tracking-label mt-3 font-sans text-base font-bold uppercase sm:text-lg"
          >
            Why choose Body Biotics?
          </h2>

          <div
            className="text-sand mt-2 flex justify-center gap-0.5"
            role="img"
            aria-label="Rated 4.7 out of 5"
          >
            {[0, 1, 2, 3].map((index) => (
              <StarIcon key={index} className="h-7 w-7" />
            ))}
            <HalfStarIcon className="h-7 w-7" />
          </div>

          <p className="mt-4 text-base leading-relaxed text-white/90">
            high-quality, safe, and effective personal care and wellness products. Promote
            holistic health, confidence, and self-care across diverse customer needs
          </p>
        </Reveal>

        <div className="flex items-end rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-[2px] sm:p-4">
          <ul className="grid w-full gap-3 sm:grid-cols-3">
            {FEATURES.map(({ title, Icon }, index) => (
              <Reveal
                as="li"
                key={title}
                delay={index * 130}
                className="card-hover flex items-center gap-4 rounded-xl border border-white/5 bg-black/25 p-3 backdrop-blur-sm sm:p-4"
              >
                <span className="bg-sand text-cocoa-deep flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl">
                  <Icon className="h-10 w-10" />
                </span>
                <span className="max-w-[10rem] font-sans text-lg leading-tight font-bold text-white">
                  {title}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
