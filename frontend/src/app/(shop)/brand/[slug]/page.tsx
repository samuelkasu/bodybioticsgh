import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchivePage } from "@/components/commerce/ArchivePage";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBrand } from "@/lib/api/server";
import { breadcrumbJsonLd, pageSeo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/brand/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) {
    return { title: "Brand not found", robots: { index: false, follow: true } };
  }

  const description = `${brand.name} at Body Biotics GH — ${brand.productCount} products, delivered across Ghana.`;

  return pageSeo({
    title: brand.name,
    description,
    path: `/brand/${brand.slug}`,
  });
}

export default async function BrandPage({ params }: PageProps<"/brand/[slug]">) {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) notFound();

  return (
    <>
      {/* Mirrors the Home / Shop / <brand> trail ArchivePage renders. */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: brand.name, path: `/brand/${brand.slug}` },
        ])}
      />
      <ArchivePage slug={slug} kind="brand" />
    </>
  );
}
