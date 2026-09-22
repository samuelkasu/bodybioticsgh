import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchivePage } from "@/components/commerce/ArchivePage";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCategory } from "@/lib/api/server";
import { breadcrumbJsonLd, pageSeo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: true } };
  }

  const description = `Shop ${category.productCount} ${category.name.toLowerCase()} products at Body Biotics GH, delivered across Ghana.`;

  return pageSeo({
    title: category.name,
    description,
    path: `/category/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;

  // A real 404 for an unknown slug; the old site's category URLs are still
  // being crawled. `cache` shares this request with generateMetadata.
  const category = await getCategory(slug);
  if (!category) notFound();

  return (
    <>
      {/* Mirrors the Home / Shop / <category> trail ArchivePage renders. */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: category.name, path: `/category/${category.slug}` },
        ])}
      />
      <ArchivePage slug={slug} kind="category" />
    </>
  );
}
