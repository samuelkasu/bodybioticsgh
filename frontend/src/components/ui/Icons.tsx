import type { SVGProps } from "react";

/**
 * Inline strokes rather than an icon package: the original used Font Awesome
 * and Elementor's icon set, and shipping a whole library for eight glyphs is
 * dead weight on a phone.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const MenuIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2} {...props}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2} {...props}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const CalendarIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 3v3M16 3v3M4 8.5h16M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const EyeIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.7A10.4 10.4 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a18 18 0 0 1-3.3 4.1" />
    <path d="M6.3 7.9A17.8 17.8 0 0 0 2 12s3.6 6.5 10 6.5a10.7 10.7 0 0 0 4-.73" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export const UserIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </svg>
);

export const BagIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 7h12l1 13H5L6 7Z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);

/**
 * The four brand marks come from the artwork in `public/` (cart, product, love,
 * flower). They are filled outlines, so they take fill rather than stroke.
 */
const filled = { fill: "currentColor", "aria-hidden": true } as const;

/** Feature tile: fast delivery. */
export const ShippingIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path d="M216,42H40A14,14,0,0,0,26,56V200a14,14,0,0,0,14,14H216a14,14,0,0,0,14-14V56A14,14,0,0,0,216,42Zm2,158a2,2,0,0,1-2,2H40a2,2,0,0,1-2-2V56a2,2,0,0,1,2-2H216a2,2,0,0,1,2,2ZM174,88a46,46,0,0,1-92,0,6,6,0,0,1,12,0,34,34,0,0,0,68,0,6,6,0,0,1,12,0Z" />
  </svg>
);

/** Feature tile: product quality. */
export const JarIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...filled} {...props}>
    <path d="m22,12.351v-1.851c0-1.208-.86-2.217-2-2.449v-.051c0-3.296-1.883-6.354-3.148-7.606-.34-.337-.826-.48-1.297-.382-.448.093-.802.386-.969.802-.665,1.655-1.415,2.187-3.086,2.187h-2c-4.51,0-5.32,3.738-5.466,5.047-1.156.219-2.034,1.234-2.034,2.453v1.851c-1.178.564-2,1.758-2,3.149v4c0,2.481,2.019,4.5,4.5,4.5h15c2.481,0,4.5-2.019,4.5-4.5v-4c0-1.391-.822-2.585-2-3.149ZM9.5,4h2c2.4,0,3.315-1.076,4.014-2.813.056-.138.177-.182.244-.195.108-.024.27-.005.391.113,1.103,1.091,2.852,3.928,2.852,6.896H5.036c.145-1.177.866-4,4.464-4Zm-6.5,6.5c0-.827.673-1.5,1.5-1.5h15c.827,0,1.5.673,1.5,1.5v1.551c-.165-.024-.329-.051-.5-.051H3.5c-.171,0-.335.027-.5.051v-1.551Zm20,9c0,1.93-1.57,3.5-3.5,3.5H4.5c-1.93,0-3.5-1.57-3.5-3.5v-4c0-1.379,1.121-2.5,2.5-2.5h17c1.379,0,2.5,1.121,2.5,2.5v4Z" />
  </svg>
);

/** Removes a cart line. Labelled, since the glyph alone carries the meaning. */
export const TrashIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M10 4h4M9 7v12M15 7v12M6 7l1 13h10l1-13" />
  </svg>
);

/** Quantity stepper keys. Glyphs, not "−" and "+" text, so the two keys match
    in weight and do not shift with the font. */
export const MinusIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2} {...props}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Toast status glyphs. Stroked so they read at 16px inside a filled chip. */
export const CheckIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2.25} {...props}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const AlertIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

export const InfoIcon = (props: IconProps) => (
  <svg {...base} strokeWidth={2} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);

/** Feature tile: customer care. */
export const HeartIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path d="M178,42c-21,0-39.26,9.47-50,25.34C117.26,51.47,99,42,78,42a60.07,60.07,0,0,0-60,60c0,29.2,18.2,59.59,54.1,90.31a334.68,334.68,0,0,0,53.06,37,6,6,0,0,0,5.68,0,334.68,334.68,0,0,0,53.06-37C219.8,161.59,238,131.2,238,102A60.07,60.07,0,0,0,178,42ZM128,217.11C111.59,207.64,30,157.72,30,102A48.05,48.05,0,0,1,78,54c20.28,0,37.31,10.83,44.45,28.27a6,6,0,0,0,11.1,0C140.69,64.83,157.72,54,178,54a48.05,48.05,0,0,1,48,48C226,157.72,144.41,207.64,128,217.11Z" />
  </svg>
);

/**
 * Solid counterpart to HeartIcon. The wishlist toggle swaps between the two so
 * saved and unsaved differ in shape, not only in colour.
 */
export const HeartFilledIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z" />
  </svg>
);

/** Petal mark used beside the essential-skincare copy. */
export const LeafIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...filled} {...props}>
    <path d="m23.443,9.536c-.423-.417-1.011-.605-1.601-.514-1.909.288-3.665,1.045-5.168,2.148-.192-2.78-1.325-5.688-3.114-7.926-.755-.944-2.365-.944-3.12,0-1.76,2.202-2.914,5.17-3.113,7.925-1.526-1.116-3.313-1.875-5.257-2.15-.558-.077-1.11.106-1.518.509-.411.404-.605.958-.534,1.519.791,6.245,5.942,10.954,11.981,10.954,6,0,11.152-4.674,11.983-10.873.08-.596-.117-1.176-.54-1.592ZM11.221,3.867c.373-.467,1.185-.467,1.558,0,1.823,2.281,2.914,5.304,2.924,8.094-1.734,1.569-3.035,3.638-3.701,5.967-.666-2.334-1.967-4.404-3.704-5.971.011-2.749,1.129-5.845,2.924-8.09ZM1.011,10.92c-.032-.249.051-.504.243-.681.259-.239.64-.236.676-.231,5.294.75,9.325,5.423,9.56,10.98-5.314-.257-9.773-4.499-10.479-10.068Zm21.981.075c-.741,5.527-5.2,9.737-10.481,9.993.234-5.515,4.231-10.187,9.479-10.977.047-.007.51-.059.751.238.174.214.288.465.25.746Z" />
  </svg>
);

/** Contact card: phone, email, shop address — the original's duotone set. */
export const PhoneIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path
      d="M215.94,182.08A48.33,48.33,0,0,1,168,224,136,136,0,0,1,32,88,48.33,48.33,0,0,1,73.92,40.06a8,8,0,0,1,8.3,4.8l21.13,47.2a8,8,0,0,1-.66,7.53L81.32,125a7.93,7.93,0,0,0-.54,7.81c8.27,16.93,25.77,34.22,42.75,42.41a7.92,7.92,0,0,0,7.83-.59l25-21.3a8,8,0,0,1,7.59-.69l47.16,21.13A8,8,0,0,1,215.94,182.08Z"
      opacity="0.2"
    />
    <path d="M144.27,45.93a8,8,0,0,1,9.8-5.66,86.22,86.22,0,0,1,61.66,61.66,8,8,0,0,1-5.66,9.8A8.23,8.23,0,0,1,208,112a8,8,0,0,1-7.73-5.94,70.35,70.35,0,0,0-50.33-50.33A8,8,0,0,1,144.27,45.93Zm-2.33,41.8c13.79,3.68,22.65,12.54,26.33,26.33A8,8,0,0,0,176,120a8.23,8.23,0,0,0,2.07-.27,8,8,0,0,0,5.66-9.8c-5.12-19.16-18.5-32.54-37.66-37.66a8,8,0,1,0-4.13,15.46Zm81.94,95.35A56.26,56.26,0,0,1,168,232C88.6,232,24,167.4,24,88A56.26,56.26,0,0,1,72.92,32.12a16,16,0,0,1,16.62,9.52l21.12,47.15,0,.12A16,16,0,0,1,109.39,104c-.18.27-.37.52-.57.77L88,129.45c7.49,15.22,23.41,31,38.83,38.51l24.34-20.71a8.12,8.12,0,0,1,.75-.56,16,16,0,0,1,15.17-1.4l.13.06,47.11,21.11A16,16,0,0,1,223.88,183.08Z" />
  </svg>
);

export const MailIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path d="M224,56l-96,88L32,56Z" opacity="0.2" />
    <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" />
  </svg>
);

export const PinIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path d="M160,64a32,32,0,1,1-32-32A32,32,0,0,1,160,64Z" opacity="0.2" />
    <path d="M120,103.2V176a8,8,0,0,0,16,0V103.2a40,40,0,1,0-16,0ZM128,40a24,24,0,1,1-24,24A24,24,0,0,1,128,40ZM240,176c0,31.18-57.71,48-112,48S16,207.18,16,176c0-7.74,3.81-19.13,22-29.41,12.26-6.94,29.12-12.27,48.77-15.42A8,8,0,1,1,89.27,147c-17.54,2.82-33,7.63-43.42,13.55C37.05,165.5,32,171.14,32,176c0,13.36,36.52,32,96,32s96-18.64,96-32c0-4.86-5.05-10.5-13.85-15.49-10.46-5.92-25.88-10.73-43.42-13.55a8,8,0,1,1,2.54-15.79c19.65,3.15,36.51,8.48,48.77,15.42C236.19,156.87,240,168.26,240,176Z" />
  </svg>
);

export const StarIcon = ({
  filled = true,
  ...props
}: IconProps & { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.5}
    {...props}
  >
    <path d="m12 3.5 2.7 5.6 6.1.8-4.5 4.2 1.2 6L12 17.3 6.5 20.1l1.2-6L3.2 9.9l6.1-.8L12 3.5Z" />
  </svg>
);

/** Rating tail: left half filled, right half muted. */
export const HalfStarIcon = (props: IconProps) => {
  const points =
    "m12 3.5 2.7 5.6 6.1.8-4.5 4.2 1.2 6L12 17.3 6.5 20.1l1.2-6L3.2 9.9l6.1-.8L12 3.5Z";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d={points} fill="currentColor" opacity={0.45} />
      <clipPath id="half-star-clip">
        <rect x="0" y="0" width="12" height="24" />
      </clipPath>
      <path d={points} fill="currentColor" clipPath="url(#half-star-clip)" />
    </svg>
  );
};

export const InstagramIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path
      d="M176,32H80A48,48,0,0,0,32,80v96a48,48,0,0,0,48,48h96a48,48,0,0,0,48-48V80A48,48,0,0,0,176,32ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"
      opacity="0.2"
    />
    <path d="M176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm64-84a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z" />
  </svg>
);

export const TiktokIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path
      d="M224,120a95.55,95.55,0,0,1-56-18v54a68,68,0,0,1-136,0c0-33.46,24.17-62.33,56-68v42.69A28,28,0,1,0,128,156V24h40a56,56,0,0,0,56,56Z"
      opacity="0.2"
    />
    <path d="M224,72a48.05,48.05,0,0,1-48-48,8,8,0,0,0-8-8H128a8,8,0,0,0-8,8V156a20,20,0,1,1-28.57-18.08A8,8,0,0,0,96,130.69V88a8,8,0,0,0-9.4-7.88C50.91,86.48,24,119.1,24,156a76,76,0,0,0,152,0V116.29A103.25,103.25,0,0,0,224,128a8,8,0,0,0,8-8V80A8,8,0,0,0,224,72Zm-8,39.64a87.19,87.19,0,0,1-43.33-16.15A8,8,0,0,0,160,102v54a60,60,0,0,1-120,0c0-25.9,16.64-49.13,40-57.6v27.67A36,36,0,1,0,136,156V32h24.5A64.14,64.14,0,0,0,216,87.5Z" />
  </svg>
);

export const WhatsappIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path
      d="M128,32A96,96,0,0,0,44.89,176.07L32.42,213.46a8,8,0,0,0,10.12,10.12l37.39-12.47A96,96,0,1,0,128,32Zm24,152a80,80,0,0,1-80-80,32,32,0,0,1,32-32l16,32-12.32,18.47a48.19,48.19,0,0,0,25.85,25.85L152,136l32,16A32,32,0,0,1,152,184Z"
      opacity="0.2"
    />
    <path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.62-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z" />
  </svg>
);

/** Cookie banner mark. The bite and the chips are cut out of one disc. */
export const CookieIcon = (props: IconProps) => (
  <svg viewBox="0 0 256 256" {...filled} {...props}>
    <path d="M164.49,163.51a12,12,0,1,1-17,0A12,12,0,0,1,164.49,163.51Zm-72-52a12,12,0,1,0,0,17A12,12,0,0,0,92.49,111.51Zm16,56a12,12,0,1,0,0,17A12,12,0,0,0,108.49,167.51Zm48-80a12,12,0,1,0,0,17A12,12,0,0,0,156.49,87.51ZM232,128A104,104,0,1,1,110.3,25.51a8,8,0,0,1,9.25,7.1,32,32,0,0,0,38.75,28.1,8,8,0,0,1,9.6,7.32,32,32,0,0,0,29.71,29.71,8,8,0,0,1,7.32,9.6,32,32,0,0,0,28.1,38.75A8,8,0,0,1,232,128Zm-16.43,7.79a48.06,48.06,0,0,1-33.72-52,48,48,0,0,1-38.4-38.4,48.06,48.06,0,0,1-52-33.72A88,88,0,1,0,215.57,135.79Z" />
  </svg>
);
