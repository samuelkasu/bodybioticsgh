import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";
import Link from "next/link";

import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { PageBanner } from "@/components/ui/PageBanner";
import { site } from "@/lib/site";
import { formatMoney } from "@/lib/utils/money";

export const metadata: Metadata = pageSeo({
  title: "Terms of Use",
  description:
    "The terms you agree to when you order from Body Biotics GH: orders, payment, delivery, cancellations, returns and refunds under Ghanaian law.",
  path: "/terms",
});

const UPDATED = "Last updated 16 September 2026";

export default function TermsPage() {
  const freeDelivery = formatMoney(site.freeDeliveryThresholdMinor, "GHS");

  return (
    <main className="flex-1">
      <PageBanner
        eyebrow="the small print"
        title="Term of use"
        image="/assets/dfefwew.jpg"
      />

      <div className="px-4 py-14 sm:px-6 lg:py-20">
        <LegalDocument
          title="Terms of use"
          updated={UPDATED}
          intro={
            <>
              <p>
                These terms govern your use of {site.name} and every order you place with
                us. Please read them before you buy. By placing an order you accept these
                terms.
              </p>
              <p>
                Nothing here takes away the rights Ghanaian law gives you as a consumer.
                The Electronic Transactions Act, 2008 (Act 772) says that a term which
                excludes your rights under that Act is void, and that our sales to
                consumers in Ghana are governed by that Act whatever an agreement says.
              </p>
            </>
          }
        >
          <LegalSection number={1} heading="Who you are buying from">
            <p>
              {site.name} is a retailer of personal care, skincare and wellness products
              based at {site.contact.address}. You can reach us on{" "}
              <a href={`tel:${site.contact.phone}`}>{site.contact.phone}</a> (also
              WhatsApp), by email at{" "}
              <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>, or
              through our <Link href="/contact">contact page</Link>.
            </p>
            <p>
              Business registration number: [to be completed]. We trade during the hours
              shown in the footer of this site.
            </p>
          </LegalSection>

          <LegalSection number={2} heading="Using this site">
            <p>
              You agree to use the site honestly and lawfully. In particular, you will
              not:
            </p>
            <ul>
              <li>
                place orders you do not intend to pay for, or use someone else&rsquo;s
                details;
              </li>
              <li>copy the catalogue in bulk, scrape the site or resell our content;</li>
              <li>
                attempt to gain access to accounts, data or systems that are not yours,
                which is a criminal offence under Act 772 and the Cybersecurity Act, 2020
                (Act 1038);
              </li>
              <li>
                upload anything unlawful, defamatory, or that infringes another
                person&rsquo;s rights.
              </li>
            </ul>
            <p>
              We may suspend or close an account that breaks these rules, and we may
              withdraw or change parts of the site at any time.
            </p>
          </LegalSection>

          <LegalSection number={3} heading="Your account">
            <p>
              You need an account to check out faster and to leave a review. You must be
              at least 18 years old to hold one. Keep your password to yourself: anything
              done through your account is treated as done by you until you tell us it was
              not.
            </p>
            <p>
              Give us details that are accurate and keep them up to date. A wrong phone
              number is the most common reason a delivery fails.
            </p>
          </LegalSection>

          <LegalSection number={4} heading="Products, photographs and prices">
            <p>
              We describe every product as accurately as we can. Photographs are
              illustrative: packaging, batch design and shade can differ from the picture,
              and manufacturers change formulations without notice. Always read the label
              on the product you receive.
            </p>
            <p>
              Prices are in Ghana cedis (GH₵) and include the taxes we are required to
              charge. Delivery is quoted separately, and is free for orders of{" "}
              {freeDelivery} or more. Prices and stock change; the price that applies to
              your order is the one shown when we confirm it.
            </p>
            <p>
              If a product is listed at an obviously wrong price, such as a decimal point
              in the wrong place, we will contact you before doing anything else, and you
              may confirm at the corrected price or cancel for a full refund.
            </p>
          </LegalSection>

          <LegalSection number={5} heading="How an order is made">
            <p>
              Adding items to your cart and submitting the checkout form is an offer to
              buy. Before you submit it you can change quantities, correct any detail you
              have typed, and leave without buying. A contract is formed only when we
              confirm your order, normally by a phone call or a message to the number you
              gave us.
            </p>
            <p>
              We may decline an order, for example where stock has run out, where the
              delivery address is outside our reach, or where we cannot verify the
              details. If you have already paid for an order we decline, we refund it in
              full.
            </p>
          </LegalSection>

          <LegalSection number={6} heading="Payment">
            <p>
              You pay on delivery, by Mobile Money or cash, unless we agree something else
              with you when we confirm the order. We do not ask for card numbers over the
              phone or by message, and we never ask for your Mobile Money PIN. Anyone who
              does is not us.
            </p>
            <p>
              Where we later offer payment before delivery, it will be through a licensed
              payment provider, and we will not store your card or wallet credentials
              ourselves.
            </p>
          </LegalSection>

          <LegalSection number={7} heading="Delivery">
            <p>
              We deliver nationwide across Ghana. Delivery within Greater Accra is
              normally same day or next day; other regions usually take two to five
              working days depending on the courier. We will always tell you the expected
              window when we confirm your order.
            </p>
            <p>
              Under section 48 of Act 772 we must carry out your order within fourteen
              days of receiving it unless we agree a different time with you. If we cannot
              supply what you ordered, we will tell you as soon as we know and refund any
              payment within seven days of telling you.
            </p>
            <p>
              Someone needs to be available at the address to receive and pay for the
              order. If nobody is there, the rider will call the number on the order; a
              second delivery attempt to the same address may be charged.
            </p>
          </LegalSection>

          <LegalSection number={8} heading="Cancelling, returning and refunds">
            <p>
              You can cancel an order at no cost any time before it is dispatched. Call or
              WhatsApp us on{" "}
              <a href={`tel:${site.contact.phone}`}>{site.contact.phone}</a>.
            </p>
            <p>
              After delivery, section 49 of Act 772 gives you fourteen days from the day
              you receive the goods to cancel without giving a reason and without penalty.
              You pay only the direct cost of returning the goods to us. To use this
              right, tell us within those fourteen days and send the items back unused and
              in their original, sealed packaging.
            </p>
            <p>
              The same section lists transactions the grace period does not cover. For a
              shop like ours the relevant exclusions are goods that by their nature cannot
              be returned, perishable goods, and items made to your specification. Because
              skincare, intimate care and supplements are applied to the body or ingested,
              we can only accept a return of those while the seal is unbroken. This does
              not affect your rights where an item is faulty, damaged in transit, expired
              or not what you ordered.
            </p>
            <p>
              Tell us about a faulty, wrong or damaged item within 48 hours of delivery,
              with a photograph if you can. We will replace it or refund it, including the
              delivery cost, and we will arrange collection at our expense.
            </p>
            <p>
              Refunds go back the way you paid, usually to the Mobile Money number that
              paid for the order, within five working days of us receiving the returned
              item or agreeing the refund. Where we failed to give you the information Act
              772 requires and you cancel for that reason, the refund is made within
              thirty days.
            </p>
          </LegalSection>

          <LegalSection number={9} heading="Using the products safely">
            <p>
              We sell cosmetics, personal care products and supplements. Nothing on this
              site is medical advice, and no product we sell is offered as a treatment for
              any disease.
            </p>
            <p>
              Some items are strong, retinoids, acids, brightening actives and supplements
              in particular, and some are restricted or prescription-only in other
              countries. Patch test before first use, follow the instructions on the
              label, use sunscreen with exfoliating actives, and speak to a pharmacist or
              doctor before you start if you are pregnant or breastfeeding, taking
              medication, or treating a skin condition. Keep every product out of reach of
              children.
            </p>
            <p>
              If a product causes a reaction, stop using it and contact us. We report
              serious product complaints to the Food and Drugs Authority where required.
            </p>
          </LegalSection>

          <LegalSection number={10} heading="Reviews you write">
            <p>
              Reviews are open to customers with an account. Your display name is shown
              with your rating, comment and any photograph you attach; your email address
              is never published. One review per product, which you can edit or delete
              whenever you like.
            </p>
            <p>
              Write about the product and your own experience. Do not post other
              people&rsquo;s photographs, personal information, abuse, or anything
              misleading, and do not offer or accept payment for a review. By posting, you
              let us display and reproduce your review and photograph on this site and in
              our own marketing. We may remove a review that breaks these rules or the
              law.
            </p>
          </LegalSection>

          <LegalSection number={11} heading="Our content">
            <p>
              The name {site.name}, our logo, site design, text and photography belong to
              us or to our suppliers. You may share links and print pages for your own
              use; you may not republish, sell or use them commercially without our
              written permission. Brand names and product photography remain the property
              of the brands concerned.
            </p>
          </LegalSection>

          <LegalSection number={12} heading="Our responsibility to you">
            <p>
              We stand behind what we sell. We are responsible for delivering goods that
              match their description, are of satisfactory quality and are fit for their
              ordinary purpose, and nothing in these terms removes that or any other right
              Ghanaian law gives you, including under Act 772 and the Sale of Goods Act,
              1962 (Act 137).
            </p>
            <p>
              Beyond that, we are not liable for losses we could not reasonably have
              foreseen, such as lost profit, lost time or business losses, and our total
              liability for any order is limited to the amount you paid for it. We are not
              responsible for reactions caused by using a product against the instructions
              on its label or against medical advice.
            </p>
          </LegalSection>

          <LegalSection number={13} heading="Your privacy">
            <p>
              What we collect, why, and what you can ask us to do with it is set out in
              our <Link href="/privacy">privacy policy</Link>, which forms part of these
              terms.
            </p>
          </LegalSection>

          <LegalSection number={14} heading="If something goes wrong">
            <p>
              Talk to us first, because most problems are settled the same day on
              WhatsApp. If we cannot agree, these terms and any dispute arising from them
              are governed by the laws of Ghana and are subject to the jurisdiction of the
              courts of Ghana.
            </p>
          </LegalSection>

          <LegalSection number={15} heading="Changes to these terms">
            <p>
              We update these terms from time to time. The version published here when you
              place an order is the one that applies to it, so the date at the top of this
              page matters. Material changes are noted on this page.
            </p>
          </LegalSection>
        </LegalDocument>
      </div>
    </main>
  );
}
