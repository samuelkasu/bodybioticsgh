import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/commerce/ProductDetail";
import { JsonLd } from "@/components/seo/JsonLd";
import { getProductDetail } from "@/lib/api/server";
import { absoluteUrl, breadcrumbJsonLd, canonical } from "@/lib/seo";

/** Product descriptions run long; search results cut off around 160 characters. */
const META_DESCRIPTION_LIMIT = 160;

function summarise(description: string, fallback: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length === 0) return fallback;
  if (text.length <= META_DESCRIPTION_LIMIT) return text;

  // Cut at a word boundary rather than mid-word.
  const clipped = text.slice(0, META_DESCRIPTION_LIMIT);
  return `${clipped.slice(0, clipped.lastIndexOf(" "))}…`;
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProductDetail(slug);

  if (!detail) {
    return { title: "Product not found", robots: { index: false, follow: true } };
  }

  const { product } = detail;
  const description = summarise(
    product.description,
    `${product.name} — available from Body Biotics GH, delivered across Ghana.`,
  );
  const url = absoluteUrl(`/product/${product.slug}`);

  return {
    title: product.name,
    description,
    alternates: canonical(`/product/${product.slug}`),
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url,
      images: [{ url: product.imageUrl, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [product.imageUrl],
    },
  };
}

/** #F3F3F3 band with the two white cards on it, as on the original. */
export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;

  // Resolved on the server so an unknown slug answers a real 404 rather than
  // a 200 with an error state inside it — the old site's dead product URLs are
  // still being crawled, and a soft 404 keeps them in the index forever.
  // `cache` means generateMetadata above and this call share one request.
  const detail = await getProductDetail(slug);
  if (!detail) notFound();

  const { product } = detail;
  const url = absoluteUrl(`/product/${product.slug}`);

  return (
    <main className="py-section-xs flex-1 bg-[#f3f3f3] px-4 sm:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: summarise(product.description, product.name),
          image: detail.images.map((image) => image.url),
          ...(product.sku ? { sku: product.sku } : {}),
          ...(product.brandName
            ? { brand: { "@type": "Brand", name: product.brandName } }
            : {}),
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: product.currency,
            // Major units with two decimals: schema.org wants the displayed
            // price, not our internal pesewas.
            price: (product.priceMinor / 100).toFixed(2),
            availability: product.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
          // No aggregateRating until reviews are actually summarised on this
          // endpoint. Inventing one is what gets structured data penalised.
        }}
      />

      {/*
        Mirrors the trail ProductDetail renders: Home / Shop, plus the category
        only when the product actually has one — the visible breadcrumb omits it
        otherwise, and structured data must not describe a step that is not
        there.
      */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          ...(product.categorySlug && product.categoryName
            ? [
                {
                  name: product.categoryName,
                  path: `/category/${product.categorySlug}`,
                },
              ]
            : []),
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />

      <div className="max-w-shell mx-auto w-full">
        <ProductDetail slug={slug} />
      </div>
    </main>
  );
}
