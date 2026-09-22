"use client";

import { HeartFilledIcon, HeartIcon } from "@/components/ui/Icons";
import type { Product } from "@/lib/features/products/types";
import {
  useGetWishlistQuery,
  useRemoveFromWishlistMutation,
  useSaveToWishlistMutation,
} from "@/lib/features/wishlist/wishlistApi";
import { toastShown } from "@/lib/features/ui/toastSlice";
import { useAppDispatch } from "@/lib/store/hooks";
import { cn } from "@/lib/utils/cn";

export type WishlistButtonProps = {
  product: Product;
  /** "card" floats over the photo; "inline" sits in a row of page controls. */
  variant?: "card" | "inline";
  className?: string;
};

/**
 * Save toggle. The wishlist lives on the server rather than in localStorage —
 * iOS drops a whole origin's storage after about a week of no use, and a list
 * someone curated over a month disappearing is not a trade worth making.
 *
 * One query backs every button on the page: RTK Query dedupes `getWishlist`,
 * so a 24-card grid costs one request, not 24.
 */
export function WishlistButton({
  product,
  variant = "card",
  className,
}: WishlistButtonProps) {
  const dispatch = useAppDispatch();
  const { data: wishlist } = useGetWishlistQuery();
  const [save, { isLoading: isSaving }] = useSaveToWishlistMutation();
  const [remove, { isLoading: isRemoving }] = useRemoveFromWishlistMutation();

  // `items?` as well as `wishlist?`: a malformed or half-written response must
  // not take the product card down with it. A heart that shows the wrong state
  // for a moment is recoverable; a grid that throws is not.
  const saved = wishlist?.items?.some((item) => item.id === product.id) ?? false;
  const busy = isSaving || isRemoving;

  const onClick = () => {
    // Optimistic either way (see wishlistApi), so the heart fills before the
    // request lands and rolls back if it fails.
    if (saved) {
      void remove({ productId: product.id });
      dispatch(
        toastShown(`Removed ${product.name} from your wishlist.`, {
          tone: "info",
          icon: "heart-off",
        }),
      );
    } else {
      void save({ product });
      // On a card the heart is 32px of colour change in the corner of a photo.
      // Easy to miss, and "did that save?" sends people to the wishlist page
      // to check.
      dispatch(
        toastShown(`Saved ${product.name} for later.`, {
          icon: "heart",
          action: { label: "View wishlist", href: "/wishlist" },
        }),
      );
    }
  };

  const label = saved
    ? `Remove “${product.name}” from your wishlist`
    : `Save “${product.name}” to your wishlist`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-pressed={saved}
      title={saved ? "Saved" : "Save for later"}
      className={cn(
        "focus-ring inline-flex items-center justify-center transition-colors duration-200 disabled:opacity-60",
        variant === "card"
          ? // 44px hit area on a control that only looks 32px, so a thumb can
            // still land on it in a two-up grid.
            "absolute top-1.5 right-1.5 z-10 h-11 w-11 rounded-full bg-white/85 backdrop-blur-sm hover:bg-white"
          : "border-card-line/80 rounded-card min-h-12 gap-2 border px-4 text-sm font-medium",
        saved ? "text-red-600" : "text-ink/60 hover:text-ink",
        className,
      )}
    >
      {/* Outline until saved, solid after: the shape carries the state, so it
          does not rely on colour alone. */}
      {saved ? (
        <HeartFilledIcon className="h-5 w-5" />
      ) : (
        <HeartIcon className="h-5 w-5" />
      )}
      {variant === "inline" && <span>{saved ? "Saved" : "Save for later"}</span>}
    </button>
  );
}
