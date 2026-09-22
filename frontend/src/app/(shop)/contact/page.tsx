import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";
import { DM_Sans, Poppins } from "next/font/google";
import Image from "next/image";

import { ContactForm } from "@/components/contact/ContactForm";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/Icons";
import { PageBanner } from "@/components/ui/PageBanner";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

export const metadata: Metadata = pageSeo({
  title: "Contact Us",
  description: "Reach out to us for support, inquiries or requests.",
  path: "/contact",
});

// The two faces this page uses on the original: Poppins for the eyebrow and
// the form controls, DM Sans for the send button. Declared here rather than in
// the root layout so no other route pays to download them.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const DETAILS = [
  {
    Icon: PhoneIcon,
    title: "Phone Number",
    value: site.contact.phone,
    href: `tel:${site.contact.phone}`,
  },
  {
    Icon: MailIcon,
    title: "Email Address",
    value: site.contact.email,
    href: `mailto:${site.contact.email}`,
  },
  { Icon: PinIcon, title: "Shop Address", value: site.contact.address, href: undefined },
];

export default function ContactPage() {
  return (
    <main className={`${poppins.variable} ${dmSans.variable} flex-1`}>
      <PageBanner
        eyebrow="We are available"
        title="Contact Us"
        image="/assets/dgefwef.jpg"
      />

      {/* Photo and contact card on the left, form on the right — the order the
          original lays them out in. */}
      <section className="py-section px-5">
        <div className="max-w-shell mx-auto flex w-full flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex w-full flex-col gap-8 lg:w-[36.49%]">
            <Reveal animation="left">
              <Image
                src="/assets/black-lady-holding-open-bottle-with-moisturizing-face-serum-enjoying-making-daily-skin-care-1024x683.jpg"
                alt="A customer applying a Body Biotics face serum"
                width={1024}
                height={683}
                sizes="(max-width: 1024px) 100vw, 480px"
                className="rounded-card h-auto w-full object-cover"
              />
            </Reveal>

            <Reveal className="rounded-card bg-[#011b1b] px-6 pt-8 pb-12 lg:px-10">
              <h2 className="text-mist lg:text-display-sm text-center font-sans text-xl font-medium">
                Contact Info
              </h2>

              <dl className="mt-8 flex flex-col gap-4">
                {DETAILS.map(({ Icon, title, value, href }, index) => (
                  <Reveal
                    key={title}
                    delay={index * 120}
                    className="flex items-start gap-4"
                  >
                    <span className="text-ink rounded-pill flex shrink-0 items-center justify-center bg-[#f6f7f6] p-3">
                      <Icon className="h-[33px] w-[33px]" />
                    </span>

                    <div>
                      <dt className="text-[#b6b6b6]">{title}</dt>
                      <dd className="mt-2 text-white">
                        {href ? (
                          <a href={href} className="focus-ring hover:underline">
                            {value}
                          </a>
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  </Reveal>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal animation="right" className="w-full lg:w-[57.54%]">
            <p className="text-cocoa tracking-caps text-center font-[family-name:var(--font-poppins)] text-base font-semibold uppercase lg:text-left">
              Reach out to us
            </p>
            <h2 className="text-display-md mt-4 text-center font-sans font-normal tracking-normal lg:text-left">
              Reach out to Us For Support, Inquiries, or Request.
            </h2>

            <div className="mt-8 lg:mt-10">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
