/**
 * Store details carried over from the previous site. Kept in one module so a
 * phone number or an opening time is changed in a single place rather than
 * hunted through JSX.
 */
export const site = {
  name: "Body Biotics GH",
  shortName: "Body Biotics",
  tagline: "Skincare and body care, delivered across Ghana.",
  description:
    "High-quality, safe and effective personal care and wellness products. Holistic health, confidence and self-care driven.",
  announcement: "Free nationwide delivery for orders above 2000 GH₵",
  /** Threshold behind the announcement, in minor units. */
  freeDeliveryThresholdMinor: 200_000,
  contact: {
    phone: "+233596342635",
    whatsapp: "https://wa.me/233596342635",
    email: "info@bodybioticsgh.com",
    address: "Accra, Ghana",
  },
  social: {
    instagram: "https://www.instagram.com/body_biotics",
    tiktok: "https://www.tiktok.com/@body_biotics",
  },
  /** What the original footer prints, split so each rule sits on its own line. */
  openingHoursSummary: ["Monday To Friday 8:30-18:00.", "Saturday and Sunday. Closed."],
  openingHours: [
    { days: "Monday – Friday", hours: "9:00am – 7:00pm" },
    { days: "Saturday", hours: "9:00am – 6:00pm" },
    { days: "Sunday", hours: "Closed" },
  ],
  nav: [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact Us" },
  ],
} as const;

export type NavItem = (typeof site.nav)[number];
