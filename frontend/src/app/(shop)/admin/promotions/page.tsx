import type { Metadata } from "next";

import { PromotionAdmin } from "@/components/admin/PromotionAdmin";

export const metadata: Metadata = { title: "Promotions" };

export default function AdminPromotionsPage() {
  return <PromotionAdmin />;
}
