import type { Metadata } from "next";

import { ProductAdmin } from "@/components/admin/ProductAdmin";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return <ProductAdmin />;
}
