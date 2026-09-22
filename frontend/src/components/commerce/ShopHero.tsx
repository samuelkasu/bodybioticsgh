import Image from "next/image";

export type ShopHeroProps = {
  /** Small pill above the title; "enjoy shopping" on the original shop page. */
  eyebrow?: string;
  title: string;
};

/**
 * Archive banner: the group portrait under a 27% black wash, a bordered pill
 * eyebrow and the title in Wahiyang at 88px — the original's shop header.
 */
export function ShopHero({ eyebrow = "enjoy shopping", title }: ShopHeroProps) {
  return (
    <section className="pt-section pb-section-sm relative isolate flex items-center justify-center px-4">
      <Image
        src="/assets/diversity-beauty-and-portrait-of-a-group-of-women-2025-04-05-21-37-01-utc.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        // The archive's LCP element, and the heaviest image on /shop at the
        // default quality. It is a full-bleed photo under a 27% black wash
        // with the title over it, object-cover crops most of it away, and no
        // one is inspecting it — 62 is indistinguishable here and roughly
        // halves the bytes in front of the largest paint.
        quality={62}
        className="-z-20 object-cover object-center"
      />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-black/[0.27]" />

      <div className="max-w-shell mx-auto flex w-full flex-col items-start gap-1 md:items-center md:gap-2.5">
        <p className="rounded-pill text-meta tracking-caps md:text-meta border-2 border-[#adc178]/15 bg-[#464646]/5 px-3 py-2 font-medium text-[#ecd8c5] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-script text-display-xl tracking-normal text-[#f6f7f6]">
          {title}
        </h1>
      </div>
    </section>
  );
}
