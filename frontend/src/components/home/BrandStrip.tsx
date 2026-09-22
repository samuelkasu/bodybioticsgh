import Image from "next/image";

/**
 * White band of stockist logos that slides continuously, never resting on a
 * position. Two identical runs sit side by side and the track is translated by
 * exactly one run plus one gap, so the moment it finishes the second run is
 * where the first began and the jump back is invisible.
 *
 * Pure CSS: no timer, no refs, nothing to hydrate. It also means the strip
 * cannot stall on a slow device, which a JavaScript-driven scroll can.
 */
const LOGOS = [
  { src: "/brand/logos/fgre.webp", alt: "Nineless" },
  { src: "/brand/logos/dfgegedf.webp", alt: "billie" },
  { src: "/brand/logos/dfgefefe.webp", alt: "medicube" },
  { src: "/brand/logos/dtgg.webp", alt: "celimax" },
  { src: "/brand/logos/DTGEF.webp", alt: "SKIN1004" },
  { src: "/brand/logos/dfefed.webp", alt: "Purito Seoul" },
  { src: "/brand/logos/DTGEGF.webp", alt: "Dr. Althea" },
  { src: "/brand/logos/fgedef.webp", alt: "CeraVe" },
];

function Run({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul
      // The second run is decoration: without this a screen reader would read
      // all eight brands twice.
      aria-hidden={duplicate || undefined}
      className="flex shrink-0 items-center gap-12"
    >
      {LOGOS.map((logo) => (
        // A fixed slot, not the logo's natural width. Two reasons: the runs
        // then measure exactly the same, which is what keeps the loop from
        // drifting a couple of pixels per pass, and these marks vary hugely in
        // width — uniform slots stop CeraVe dwarfing celimax.
        <li
          key={logo.src}
          className="flex w-[180px] shrink-0 items-center justify-center"
        >
          <Image
            src={logo.src}
            alt={duplicate ? "" : logo.alt}
            width={280}
            height={110}
            sizes="180px"
            className="h-[3.63rem] w-auto max-w-full object-contain sm:h-[4.24rem]"
          />
        </li>
      ))}
    </ul>
  );
}

export function BrandStrip() {
  return (
    <section
      aria-label="Brands we stock"
      className="defer-paint overflow-hidden bg-white py-10"
    >
      {/*
        gap-12 here as well as inside each run, so the spacing across the seam
        matches the spacing between logos.

        No horizontal padding: the translation is a percentage of this element,
        so padding would be counted in the 50% and the loop would drift a little
        further left on every pass. A marquee runs edge to edge regardless.
      */}
      <div className="brand-marquee flex w-max items-center gap-12">
        <Run />
        <Run duplicate />
      </div>
    </section>
  );
}
