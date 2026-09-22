import type { Metadata } from "next";

import { CouponAdmin } from "@/components/admin/CouponAdmin";

export const metadata: Metadata = { title: "Discount codes" };

export default function AdminCouponsPage() {
  return <CouponAdmin />;
}
