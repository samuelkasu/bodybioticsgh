"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useAddToCartMutation } from "@/lib/features/cart/cartApi";
import { cartToggled, itemAdded } from "@/lib/features/cart/cartSlice";
import type { Product } from "@/lib/features/products/types";
import { toastShown } from "@/lib/features/ui/toastSlice";
import { useAppDispatch } from "@/lib/store/hooks";

export type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  /** "olive" in the catalogue grid, black everywhere else. */
  variant?: "primary" | "olive";
  /** Opens the cart drawer after a successful add; off in dense grids. */
  openCartOnAdd?: boolean;
  /** The featured carousel labels its buttons in sentence case. */
  uppercase?: boolean;
  /** Per-surface tweaks, e.g. the product page's wider 9px-radius button. */
  className?: string;
};

export function AddToCartButton({
  product,
  quantity = 1,
  fullWidth = false,
  size = "md",
  variant = "primary",
  openCartOnAdd = false,
  uppercase = true,
  className,
}: AddToCartButtonProps) {
  const dispatch = useAppDispatch();
  const [addToCart, { isLoading }] = useAddToCartMutation();
  const [failed, setFailed] = useState(false);

  if (!product.inStock) {
    return (
      <Button
        variant="outline"
        size={size}
        fullWidth={fullWidth}
        uppercase={uppercase}
        className={className}
        disabled
      >
        Sold out
      </Button>
    );
  }

  const onClick = async () => {
    setFailed(false);
    // Optimistic: the header count and drawer move on tap, and the server
    // response overwrites this a moment later.
    dispatch(itemAdded(product, quantity));

    try {
      await addToCart({ productId: product.id, quantity }).unwrap();

      if (openCartOnAdd) {
        dispatch(cartToggled(true));
      } else {
        // The drawer is its own confirmation. Without it the only signal is
        // the header count, and the header is not sticky — in a catalogue
        // grid scrolled halfway down, that badge is off-screen.
        dispatch(
          toastShown(`${product.name} added to your cart.`, {
            icon: "cart",
            action: { label: "View cart", href: "/cart" },
          }),
        );
      }
    } catch {
      // Roll the optimistic line back rather than leaving a phantom item.
      dispatch(itemAdded(product, -quantity));
      setFailed(true);
      dispatch(
        toastShown("We could not add that. Check your connection and try again.", {
          tone: "error",
        }),
      );
    }
  };

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        uppercase={uppercase}
        className={className}
        disabled={isLoading}
        onClick={() => void onClick()}
      >
        {isLoading ? "Adding…" : "Add to cart"}
      </Button>
      {failed && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          Could not add that. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
