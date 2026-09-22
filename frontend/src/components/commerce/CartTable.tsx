"use client";

import Image from "next/image";
import Link from "next/link";

import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { CloseIcon } from "@/components/ui/Icons";
import { useUpdateCartLineMutation } from "@/lib/features/cart/cartApi";
import {
  itemRemoved,
  quantitySet,
  selectCartLines,
  type CartLine,
} from "@/lib/features/cart/cartSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { formatMoney } from "@/lib/utils/money";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";

/** The original prints money in this olive green on the cart table. */
const MONEY = "text-[#556827] font-semibold";

/**
 * Cart table from the original: a cream header band over white rows, the
 * remove button tucked onto the corner of the thumbnail, and money in olive.
 * Collapses to stacked cards on a phone, where four columns do not fit.
 */
export function CartTable() {
  const lines = useAppSelector(selectCartLines);

  if (lines.length === 0) return null;

  return (
    <div className="rounded-control overflow-hidden border border-[#ece5db] bg-white">
      <div className="bg-blush hidden text-center text-lg font-bold text-[#101010] sm:grid sm:grid-cols-[2.2fr_1fr_1fr_1fr]">
        <p className="px-4 py-5">Product Name</p>
        <p className="px-4 py-5">Price</p>
        <p className="px-4 py-5">Quantity</p>
        <p className="px-4 py-5">Subtotal</p>
      </div>

      <ul className="divide-y divide-[#efe9e1]">
        {lines.map((line) => (
          <li key={line.productId}>
            <CartTableRow line={line} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartTableRow({ line }: { line: CartLine }) {
  const dispatch = useAppDispatch();
  const [updateLine, { isLoading }] = useUpdateCartLineMutation();

  const setQuantity = async (quantity: number) => {
    // Optimistic first so the total moves immediately.
    if (quantity === 0) {
      dispatch(itemRemoved(line.productId));
    } else {
      dispatch(quantitySet({ productId: line.productId, quantity }));
    }

    try {
      await updateLine({ productId: line.productId, quantity }).unwrap();
    } catch {
      // The server response is authoritative; a refetch on the next mount
      // reconciles. Nothing to roll back to that would be more correct.
    }
  };

  const overStock = line.availableStock >= 0 && line.quantity > line.availableStock;

  return (
    <div className="grid items-center gap-4 px-4 py-5 sm:grid-cols-[2.2fr_1fr_1fr_1fr] sm:gap-2 sm:text-center">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Link
            href={`/product/${line.slug}`}
            className="focus-ring rounded-control relative block h-20 w-20 overflow-hidden border border-[#ece5db] bg-white"
          >
            <Image
              src={line.imageUrl}
              alt={line.name}
              fill
              sizes="80px"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-contain p-1"
            />
          </Link>

          <button
            type="button"
            aria-label={`Remove ${line.name} from your cart`}
            onClick={() => void setQuantity(0)}
            disabled={isLoading}
            className="focus-ring absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#9a9a9a] text-white transition-colors hover:bg-[#101010]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-w-0 text-left">
          <Link
            href={`/product/${line.slug}`}
            className="focus-ring tracking-label text-base font-bold text-[#101010] uppercase no-underline hover:no-underline sm:text-lg"
          >
            {line.name}
          </Link>

          {overStock && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              Only {line.availableStock} left — reduce the quantity to continue.
            </p>
          )}
        </div>
      </div>

      <p className={`${MONEY} text-base sm:text-lg`}>
        <span className="text-cocoa mr-2 text-sm font-normal sm:hidden">Price</span>
        {formatMoney(line.unitPriceMinor, line.currency)}
      </p>

      <div className="flex justify-start sm:justify-center">
        <QuantityStepper
          quantity={line.quantity}
          label={line.name}
          disabled={isLoading}
          onChange={(quantity) => void setQuantity(quantity)}
        />
      </div>

      <p className={`${MONEY} text-base sm:text-lg`}>
        <span className="text-cocoa mr-2 text-sm font-normal sm:hidden">Subtotal</span>
        {formatMoney(line.unitPriceMinor * line.quantity, line.currency)}
      </p>
    </div>
  );
}
