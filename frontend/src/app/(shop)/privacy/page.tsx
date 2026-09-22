import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";
import Link from "next/link";

import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { PageBanner } from "@/components/ui/PageBanner";
import { site } from "@/lib/site";

export const metadata: Metadata = pageSeo({
  title: "Privacy Policy",
  description:
    "How Body Biotics GH collects, uses, shares and protects your personal data under Ghana's Data Protection Act, 2012 (Act 843), and the rights you have over it.",
  path: "/privacy",
});

const UPDATED = "Last updated 16 September 2026";

export default function PrivacyPage() {
  return (
    <main className="flex-1">
      <PageBanner
        eyebrow="your data, your control"
        title="Privacy Policy"
        image="/assets/dgefwef.jpg"
      />

      <div className="px-4 py-14 sm:px-6 lg:py-20">
        <LegalDocument
          title="Privacy policy"
          updated={UPDATED}
          intro={
            <>
              <p>
                This policy explains what personal data {site.name} collects when you use
                this site, why we collect it, who sees it, how long we keep it and what
                you can ask us to do with it.
              </p>
              <p>
                We are the data controller for that information. We process it under the
                Data Protection Act, 2012 (Act 843) and follow the eight principles that
                Act sets out, including accountability, lawfulness, purpose specification,
                openness and data security.
              </p>
            </>
          }
        >
          <LegalSection number={1} heading="Who we are and how to reach us">
            <p>
              {site.name}, {site.contact.address}. Phone and WhatsApp{" "}
              <a href={`tel:${site.contact.phone}`}>{site.contact.phone}</a>, email{" "}
              <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>. Data
              Protection Commission registration number: [to be completed].
            </p>
            <p>
              For anything about your personal data, write to the email address above with
              &ldquo;Data request&rdquo; in the subject line.
            </p>
          </LegalSection>

          <LegalSection number={2} heading="What we collect">
            <p>
              <strong>When you create an account:</strong> your email address and a
              password, and optionally your name and phone number. We never store your
              password itself, only a one-way hash of it, which cannot be read back.
            </p>
            <p>
              <strong>When you order:</strong> your name, email address, phone number,
              delivery address and town, any note you add for the rider, and the items,
              quantities and totals in the order.
            </p>
            <p>
              <strong>When you pay:</strong> you pay the rider on delivery, so we do not
              collect card or Mobile Money credentials on this site. If we later take
              payment online, it will go through a licensed payment provider that handles
              those details directly; we would only see the result.
            </p>
            <p>
              <strong>When you write to us:</strong> the name, email address, subject and
              message you put into the contact form, and anything you send us on WhatsApp.
            </p>
            <p>
              <strong>When you review a product:</strong> your rating, your comment, any
              photograph you attach, and the display name shown beside it. Reviews and
              photographs are public.
            </p>
            <p>
              <strong>Automatically:</strong> the request logs our servers keep, which
              record your IP address, the date and time, the page requested and your
              browser&rsquo;s user agent. We use them to keep the site up and to spot
              abuse such as brute-force sign-in attempts.
            </p>
            <p>
              We do not run advertising or analytics trackers on this site, and we do not
              build profiles of you for advertisers.
            </p>
          </LegalSection>

          <LegalSection number={3} heading="Cookies and what is stored on your device">
            <p>The site uses two cookies, both strictly necessary:</p>
            <ul>
              <li>
                <strong>bb_session</strong> keeps you signed in. It is HttpOnly, so
                scripts cannot read it, and it expires after 30 days of inactivity or when
                you sign out.
              </li>
              <li>
                <strong>bb_cart</strong> identifies the cart of a visitor who has not
                signed in, so your basket survives a refresh. It is created only when you
                first add something.
              </li>
            </ul>
            <p>
              Your browser also stores a note of when you dismissed the &ldquo;install the
              app&rdquo; prompt, your answer to the cookie notice, and the app&rsquo;s
              offline cache of pages and images. All three stay on your device; clearing
              your browser data removes them.
            </p>
            <p>
              Because the two cookies above are strictly necessary, the notice you saw on
              your first visit does not block the shop. It is there so you know what is
              set, and so you can decide about the optional categories — analytics and
              marketing — which are switched off unless you turn them on. You can change
              that answer at any time from <strong>Cookie settings</strong> at the bottom
              of any page.
            </p>
          </LegalSection>

          <LegalSection number={4} heading="Why we use it, and on what basis">
            <ul>
              <li>
                <strong>To fulfil your order</strong>, meaning to take payment, deliver
                and answer questions about it. Basis: performance of our contract with
                you.
              </li>
              <li>
                <strong>To run your account</strong> and keep it secure. Basis:
                performance of our contract, and our legitimate interest in preventing
                fraud and abuse.
              </li>
              <li>
                <strong>To reply to your messages and reviews.</strong> Basis: your
                consent, and our legitimate interest in supporting customers.
              </li>
              <li>
                <strong>To keep tax, accounting and delivery records.</strong> Basis:
                compliance with our legal obligations.
              </li>
              <li>
                <strong>To send offers and news</strong>, only if you ask us to. Basis:
                your consent, which you can withdraw at any time.
              </li>
            </ul>
            <p>
              We do not sell your personal data, and we do not make decisions about you by
              automated means alone.
            </p>
          </LegalSection>

          <LegalSection number={5} heading="Who else sees it">
            <ul>
              <li>
                <strong>Delivery riders and courier partners</strong> receive your name,
                phone number, address and the amount to collect, so they can deliver.
              </li>
              <li>
                <strong>Payment providers</strong>, where an order is paid other than on
                delivery.
              </li>
              <li>
                <strong>Our hosting and infrastructure providers</strong>, who store the
                site and database on our instructions.
              </li>
              <li>
                <strong>Professional advisers and the authorities</strong>, where the law
                requires it or to establish or defend a legal claim.
              </li>
            </ul>
            <p>
              Everyone we share data with is bound to use it only for the purpose we gave
              it to them for.
            </p>
          </LegalSection>

          <LegalSection number={6} heading="Storage outside Ghana">
            <p>
              Some of the providers who host this site and its data operate data centres
              outside Ghana. Where personal data leaves the country, we only use providers
              that offer protection consistent with Act 843 and hold them to contractual
              terms covering confidentiality, security and deletion.
            </p>
          </LegalSection>

          <LegalSection number={7} heading="How long we keep it">
            <ul>
              <li>
                <strong>Order and payment records:</strong> at least six years from the
                end of the year they relate to, because section 27 of the Revenue
                Administration Act, 2016 (Act 915) requires it.
              </li>
              <li>
                <strong>Account details:</strong> until you close your account, then
                deleted apart from what those tax records require us to keep.
              </li>
              <li>
                <strong>Contact messages:</strong> up to two years, so we have the history
                if you come back about the same thing.
              </li>
              <li>
                <strong>Reviews and review photographs:</strong> until you delete them or
                close your account.
              </li>
              <li>
                <strong>Server logs:</strong> a short rolling window, normally 90 days.
              </li>
            </ul>
          </LegalSection>

          <LegalSection number={8} heading="Your rights">
            <p>Under Act 843 you can ask us to:</p>
            <ul>
              <li>tell you whether we hold data about you, and give you a copy of it;</li>
              <li>correct anything inaccurate, out of date or incomplete;</li>
              <li>
                delete data we no longer have a reason to keep, and we will explain if a
                legal obligation means we must retain some of it;
              </li>
              <li>
                stop using your data for direct marketing, which we will do immediately;
              </li>
              <li>stop or limit other processing you object to, where the law allows.</li>
            </ul>
            <p>
              Where we rely on your consent, you can withdraw it at any time; that does
              not affect what we did before you withdrew it. Write to{" "}
              <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> and we
              will respond within the period the Act allows, and in any case as quickly as
              we can.
            </p>
            <p>
              If you are not satisfied with our answer, you can complain to the Data
              Protection Commission,{" "}
              <a
                href="https://www.dataprotection.org.gh"
                target="_blank"
                rel="noopener noreferrer"
              >
                dataprotection.org.gh
              </a>
              , which supervises data protection in Ghana.
            </p>
          </LegalSection>

          <LegalSection number={9} heading="How we protect it">
            <p>
              Traffic to this site is encrypted in transit. Passwords are stored only as
              hashes. Sign-in cookies are HttpOnly and can be revoked server-side, so a
              stolen cookie can be killed without waiting for it to expire. Access to the
              database is limited to the people who need it to run the shop, and uploads
              are restricted by type and size.
            </p>
            <p>
              No system is perfect. If a breach affects your personal data we will tell
              you and the Data Protection Commission, and explain what we are doing about
              it.
            </p>
          </LegalSection>

          <LegalSection number={10} heading="Children">
            <p>
              This shop is for adults. Accounts are for customers aged 18 or over, and we
              do not knowingly collect data from children. If you believe a child has
              given us their details, tell us and we will delete them.
            </p>
          </LegalSection>

          <LegalSection number={11} heading="Changes to this policy">
            <p>
              When this policy changes we update the date at the top of the page, and we
              will tell you directly if the change materially affects how we use data you
              have already given us. Our <Link href="/terms">terms of use</Link> explain
              the rest of the relationship.
            </p>
          </LegalSection>
        </LegalDocument>
      </div>
    </main>
  );
}
