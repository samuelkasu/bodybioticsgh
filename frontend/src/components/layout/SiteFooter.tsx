import Image from "next/image";
import Link from "next/link";

import { CookieSettingsButton } from "@/components/legal/CookieSettingsButton";
import { InstagramIcon, TiktokIcon, WhatsappIcon } from "@/components/ui/Icons";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

const COMPANY_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

const OTHER_LINKS = [
  { href: "/shop", label: "Shop Page" },
  { href: "/account", label: "My Account" },
  { href: "/cart", label: "Cart Page" },
  // Most orders here are placed as a guest, and a guest's only route back to
  // one was the confirmation email.
  { href: "/track", label: "Track Order" },
];

const SOCIALS = [
  { href: site.social.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: site.contact.whatsapp, label: "Whatsapp", Icon: WhatsappIcon },
  { href: site.social.tiktok, label: "Tik-Tok", Icon: TiktokIcon },
];

// inline-block with vertical padding so the tap target clears the 40px a
// thumb needs, without changing how the column looks.
const LINK_CLASS =
  "focus-ring inline-block py-2 text-[#c0cfd2] transition-colors hover:text-lime";

/**
 * Footer values are read off the original's CSS rather than guessed:
 *   band     #001111, 80px top / 50px bottom
 *   headings Inter Tight 1.25rem/600 in #E2B78E
 *   links    Inter Tight 19px/500 in #C0CFD2, #8DC916 on hover
 *   socials  #002526 pills, 13px radius
 *   hours    a black 12px card; the copyright strip is #E2B78E at 11px
 */
export function SiteFooter() {
  return (
    <footer className="bg-[#001111] px-4 pt-14 pb-10 sm:px-6 lg:pt-20 lg:pb-[50px]">
      <div className="mx-auto flex w-full max-w-[1350px] flex-col gap-14 lg:gap-20">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="w-full max-w-[420px] lg:w-[28%]">
            <Reveal>
              <Image
                src="/assets/looogo.png"
                alt={site.name}
                width={1839}
                height={579}
                sizes="(max-width: 1024px) 60vw, 300px"
                className="h-auto w-[72%] max-w-[300px]"
              />

              <p className="mt-4 text-[1.1rem] leading-[1.5] font-medium text-[#e9eae7]">
                We confidently deliver exceptional skin care products, meticulously
                crafted to exceed your expectations and ensure complete satisfaction.
              </p>

              <p className="text-lime text-meta mt-[22px] font-semibold tracking-[0.02em] uppercase">
                Secured payment channels
              </p>
              <Image
                src="/assets/payment_options.png"
                alt="Visa, Mastercard, American Express, Discover, PayPal, Maestro, JCB and Diners Club"
                width={442}
                height={32}
                sizes="(max-width: 1024px) 80vw, 400px"
                className="mt-3 h-auto w-[95%] max-w-[442px]"
              />

              <ul className="mt-9 flex flex-wrap gap-3">
                {SOCIALS.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring hover:text-lime rounded-panel text-meta flex items-center gap-2 bg-[#002526] py-[10px] pr-[15px] pl-[10px] font-medium text-[#c0cfd2] no-underline transition-colors hover:no-underline"
                    >
                      <Icon className="h-6 w-6" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal as="nav" aria-labelledby="footer-company" className="lg:w-[12%]">
            <h2
              id="footer-company"
              className="font-sans text-xl font-semibold tracking-normal text-[#e2b78e]"
            >
              Company
            </h2>
            <ul className="text-body-lg mt-8 flex flex-col gap-2 leading-[1.25] font-medium">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal as="nav" aria-labelledby="footer-other" className="lg:w-[12%]">
            <h2
              id="footer-other"
              className="font-sans text-xl font-semibold tracking-normal text-[#e2b78e]"
            >
              Other Pages
            </h2>
            <ul className="text-body-lg mt-8 flex flex-col gap-2 leading-[1.25] font-medium">
              {OTHER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            as="section"
            aria-labelledby="footer-hours"
            className="rounded-card w-full bg-black p-[30px] lg:w-[31.57%]"
          >
            <h2
              id="footer-hours"
              className="font-sans text-xl font-semibold tracking-normal text-[#e2b78e] uppercase"
            >
              Shop Opening Time
            </h2>

            <ul className="text-body-lg mt-6 flex flex-col gap-[7px] leading-[1.5] font-medium text-[#c0cfd2]">
              {site.openingHoursSummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>
                <a href={`mailto:${site.contact.email}`} className={LINK_CLASS}>
                  {site.contact.email}
                </a>
              </li>
            </ul>
          </Reveal>
        </div>

        <div className="rounded-card flex flex-col items-center justify-between gap-3 bg-[#e2b78e] p-5 text-[0.9rem] leading-[1.25] font-medium text-[#31332e] sm:flex-row">
          <p>
            Copyright © {new Date().getFullYear()} {site.name}
          </p>

          <p className="flex items-center gap-3">
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-70"
            >
              Term of use
            </Link>
            <span aria-hidden="true" className="h-3 w-px bg-[#31332e]/40" />
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-70"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true" className="h-3 w-px bg-[#31332e]/40" />
            <CookieSettingsButton className="focus-ring transition-opacity hover:underline hover:opacity-70" />
          </p>
        </div>
      </div>
    </footer>
  );
}
