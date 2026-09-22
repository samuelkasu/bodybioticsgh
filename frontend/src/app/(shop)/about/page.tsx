import type { Metadata } from "next";

import { pageSeo } from "@/lib/seo";

import { EssentialSkincare } from "@/components/home/EssentialSkincare";
import { Testimonials } from "@/components/home/Testimonials";
import { WhyChoose } from "@/components/home/WhyChoose";
import { PageBanner } from "@/components/ui/PageBanner";
import { site } from "@/lib/site";

export const metadata: Metadata = pageSeo({
  title: "About Us",
  description: site.description,
  path: "/about",
});

/** Section order follows the original About Us page exactly. */
export default function AboutPage() {
  return (
    <main className="flex-1">
      <PageBanner
        eyebrow="what you need to know"
        title="About Us"
        image="/assets/dfefwew.jpg"
      />
      <EssentialSkincare />
      <WhyChoose />
      <Testimonials />
    </main>
  );
}
