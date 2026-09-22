import type { Currency } from "@/lib/features/products/types";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";

export type PriceTagProps = {
  amountMinor: number;
  /**
   * The "was" price, struck through beside the current one. Null or absent for
   * a product that is not on sale. Ignored when it is not actually higher —
   * "was GH₵50, now GH₵50" reads as a trick.
   */
  compareAtMinor?: number | null;
  currency?: Currency;
  className?: string;
  /** Renders larger for a product page hero; "card" is the grid treatment. */
  size?: "sm" | "md" | "lg" | "card";
};

const SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  // 19px on a phone, 18px from the sand card upwards — the original's sizes.
  card: "text-body-lg font-semibold sm:text-body-lg",
} as const;

export function PriceTag({
  amountMinor,
  compareAtMinor = null,
  currency = "GHS",
  className,
  size = "md",
}: PriceTagProps) {
  const showsWas = compareAtMinor !== null && compareAtMinor > amountMinor;

  const price = (
    // <data> carries the machine-readable value for copy/paste and scrapers
    // while the text stays formatted for a Ghanaian shopper.
    <data
      value={(amountMinor / 100).toFixed(2)}
      className={cn(
        "font-medium tabular-nums",
        SIZES[size],
        // The shop's olive, not a sale red: it is the colour every other
        // saving on the storefront already uses — the discount rows in the
        // basket, the free-delivery notice — and a price should not be the one
        // place shouting in a different palette.
        showsWas && "text-olive",
        !showsWas && className,
      )}
    >
      {formatMoney(amountMinor, currency)}
    </data>
  );

  if (!showsWas) {
    return price;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-2", className)}>
      {price}
      {/* <s>, not a line-through class: the old price being no longer accurate
          is the meaning, and a screen reader should be told so. */}
      <s className="text-sm font-normal text-neutral-500 tabular-nums">
        <span className="sr-only">Was </span>
        {formatMoney(compareAtMinor, currency)}
      </s>
    </span>
  );
}
