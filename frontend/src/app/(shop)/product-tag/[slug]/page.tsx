import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductListing } from "@/components/commerce/ProductListing";
import { ProductListingFallback } from "@/components/commerce/ProductListingFallback";
import { ShopHero } from "@/components/commerce/ShopHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { getProductTag, listProductTags } from "@/lib/api/server";
import { breadcrumbJsonLd, pageSeo } from "@/lib/seo";

/** Prebuilds the tags the API knows about; the rest render on first request. */
export async function generateStaticParams() {
  const tags = await listProductTags();

  return tags.map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/product-tag/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getProductTag(slug);

  return tag
    ? pageSeo({
        title: tag.name,
        description: tag.intro,
        path: `/product-tag/${tag.slug}`,
      })
    : { title: "Tag not found", robots: { index: false, follow: true } };
}

/**
 * Tag archives carried over from the old site at their original URLs. They
 * render the same banner, grid and filters as the category and brand archives.
 */
export default async function ProductTagPage({
  params,
}: PageProps<"/product-tag/[slug]">) {
  const { slug } = await params;
  // `cache` shares this request with generateMetadata.
  const tag = await getProductTag(slug);

  if (!tag) notFound();

  return (
    <main className="flex-1">
      {/* Mirrors the Home / Shop / <tag> trail rendered below. */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: tag.name, path: `/product-tag/${tag.slug}` },
        ])}
      />

      <ShopHero eyebrow="Shop by tag" title={tag.name} />

      <div className="bg-panel">
        <nav
          aria-label="Breadcrumb"
          className="max-w-shell mx-auto w-full px-4 pt-6 text-sm text-neutral-600"
        >
          <Link href="/" className="focus-ring">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/shop" className="focus-ring">
            Shop
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{tag.name}</span>
        </nav>

        <p className="max-w-shell mx-auto w-full px-4 pt-2 text-sm text-neutral-600">
          {tag.intro}
        </p>
      </div>

      <Suspense fallback={<ProductListingFallback />}>
        <ProductListing
          {...(tag.query.category ? { fixedCategory: tag.query.category } : {})}
          {...(tag.query.brand ? { fixedBrand: tag.query.brand } : {})}
          {...(tag.query.search ? { fixedSearch: tag.query.search } : {})}
        />
      </Suspense>
    </main>
  );
}
