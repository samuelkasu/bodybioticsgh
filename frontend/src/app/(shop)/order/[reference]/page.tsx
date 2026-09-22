import { OrderConfirmation } from "@/components/commerce/OrderConfirmation";

export default async function OrderPage({ params }: PageProps<"/order/[reference]">) {
  const { reference } = await params;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <OrderConfirmation reference={reference} />
    </main>
  );
}
