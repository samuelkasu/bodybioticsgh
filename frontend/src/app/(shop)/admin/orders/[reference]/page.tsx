import type { Metadata } from "next";

import { OrderDetail } from "@/components/admin/OrderDetail";

export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[reference]">): Promise<Metadata> {
  const { reference } = await params;
  return { title: reference };
}

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[reference]">) {
  const { reference } = await params;

  return <OrderDetail reference={reference} />;
}
