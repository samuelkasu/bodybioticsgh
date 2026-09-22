"use client";

import Image from "next/image";
import Link from "next/link";

import { PriceTag } from "@/components/commerce/PriceTag";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { TrashIcon } from "@/components/ui/Icons";
import { useUpdateCartLineMutation } from "@/lib/features/cart/cartApi";
import {
  itemRemoved,
  quantitySet,
  selectCartLines,
  type CartLine,
} from "@/lib/features/cart/cartSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";

export function CartLines({ compact = false }: { compact?: boolean }) {
  const lines = useAppSelector(selectCartLines);

  if (lines.length === 0) return null;

  return (
    <ul className="divide-y divide-neutral-200">
      {lines.map((line) => (
        <li key={line.productId}>
          <CartLineRow line={line} compact={compact} />
        </li>
      ))}
    </ul>
  );
}

function CartLineRow({ line, compact }: { line: CartLine; compact: boolean }) {
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
    <div className="flex gap-3 py-4">
      <Link
        href={`/product/${line.slug}`}
        className="focus-ring relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-50"
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

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/product/${line.slug}`}
          className="focus-ring text-sm no-underline hover:no-underline"
        >
          <span className="line-clamp-2">{line.name}</span>
        </Link>

        <PriceTag
          amountMinor={line.unitPriceMinor}
          compareAtMinor={line.compareAtPriceMinor}
          currency={line.currency}
          size="sm"
        />

        {overStock && (
          <p role="alert" className="text-xs text-red-700">
            Only {line.availableStock} left — reduce the quantity to continue.
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-3">
          <QuantityStepper
            quantity={line.quantity}
            label={line.name}
            disabled={isLoading}
            onChange={(quantity) => void setQuantity(quantity)}
          />

          <button
            type="button"
            aria-label={`Remove ${line.name} from your cart`}
            onClick={() => void setQuantity(0)}
            className="focus-ring text-taupe hover:text-pager hover:bg-chip flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!compact && (
        <div className="shrink-0 text-right">
          <PriceTag
            amountMinor={line.unitPriceMinor * line.quantity}
            currency={line.currency}
          />
        </div>
      )}
    </div>
  );
}
