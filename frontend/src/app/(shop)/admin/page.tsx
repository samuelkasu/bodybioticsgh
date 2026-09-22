import type { Metadata } from "next";

import { OrderQueue } from "@/components/admin/OrderQueue";

export const metadata: Metadata = { title: "Orders" };

export default function AdminOrdersPage() {
  return <OrderQueue />;
}
