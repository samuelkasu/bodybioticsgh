import type { Metadata } from "next";

import { BrandStrip } from "@/components/home/BrandStrip";
import { EssentialSkincare } from "@/components/home/EssentialSkincare";
import { FeaturedCarousel } from "@/components/home/FeaturedCarousel";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { Hero } from "@/components/home/Hero";
import { Testimonials } from "@/components/home/Testimonials";
import { WhyChoose } from "@/components/home/WhyChoose";
import { canonical } from "@/lib/seo";

// Title and description come from the root layout; only the canonical is
// page-specific. Without it every ?fbclid= and ?utm_source= share link is a
// separate URL as far as Google is concerned.
export const metadata: Metadata = { alternates: canonical("/") };

/** Section order follows the original storefront exactly. */
export default function Home() {
  return (
    <main>
      <Hero />
      <FeaturedProducts
        eyebrow="Shop by latest"
        title="Holistic health, confidence, and self-care driven."
        sort="latest"
        limit={12}
        withSearch
      />
      <WhyChoose />
      <EssentialSkincare />
      <BrandStrip />
      <FeaturedCarousel />
      <Testimonials />
    </main>
  );
}
