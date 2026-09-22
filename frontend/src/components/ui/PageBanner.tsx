import Image from "next/image";

export type PageBannerProps = {
  /** Bordered pill above the title. */
  eyebrow: string;
  title: string;
  image: string;
};

/**
 * The About/Contact page header. Values read off the original's CSS: 122px/47px
 * padding, a 61% wash over #161C2D, the 23px pill in Inter 15/500 tracked
 * 1.6px, and the title at 76px/73px in #D3D3D3.
 */
export function PageBanner({ eyebrow, title, image }: PageBannerProps) {
  return (
    <section className="pt-section pb-section-sm relative isolate flex items-center justify-center bg-[#161C2D] px-4">
      <Image
        src={image}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-black/[0.61]" />

      <div className="max-w-shell mx-auto flex w-[77%] flex-col items-center gap-1 text-center md:gap-2">
        <p className="rounded-pill text-meta tracking-caps md:text-meta border-2 border-[#adc178]/15 bg-[#464646]/5 px-3 py-2 font-medium text-[#dfdfdf] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display text-display-lg font-semibold text-[#d3d3d3]">
          {title}
        </h1>
      </div>
    </section>
  );
}
