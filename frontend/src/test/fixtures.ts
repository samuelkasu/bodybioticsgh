import type { Product } from "@/lib/features/products/types";

/**
 * One place to build a product for a test, so adding a field to the wire type
 * does not mean editing every spec.
 */
export const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "glow-serum",
  name: "Glow Serum",
  description: "Vitamin C serum for even tone and brightness.",
  sku: "GS-001",
  priceMinor: 12_500,
  compareAtPriceMinor: null,
  discountPercent: null,
  saleEndsAt: null,
  currency: "GHS",
  imageUrl: "/catalog/glow-serum/main.webp",
  hoverImageUrl: "/catalog/glow-serum/hover.webp",
  inStock: true,
  lowStockRemaining: null,
  categorySlug: "face-serum",
  categoryName: "Face Serum",
  brandSlug: "anua",
  brandName: "Anua",
  ...overrides,
});
