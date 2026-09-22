"use client";

import Link from "next/link";

import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { useGetCartQuery } from "@/lib/features/cart/cartApi";
import { selectCartItemCount } from "@/lib/features/cart/cartSlice";
import { useAppSelector } from "@/lib/store/hooks";

export default function CheckoutPage() {
  const { isLoading } = useGetCartQuery();
  const itemCount = useAppSelector(selectCartItemCount);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-2xl">Checkout</h1>

      {itemCount === 0 && !isLoading ? (
        <EmptyState
          title="Nothing to check out"
          description="Add a product to your cart first."
          action={
            <Link href="/shop" className="focus-ring">
              <Button>Shop now</Button>
            </Link>
          }
        />
      ) : (
        <CheckoutForm />
      )}
    </main>
  );
}
