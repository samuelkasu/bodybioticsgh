import type { Currency } from "@/lib/features/products/types";

/**
 * The previous storefront printed prices as "₵120.00" — the cedi sign alone,
 * no "GH" prefix. Intl gives "GH₵120.00" for en-GH, so the number is formatted
 * with Intl (for grouping and the two decimals) and the symbol is prepended.
 */
const SYMBOLS: Record<Currency, string> = {
  GHS: "₵",
  USD: "$",
};

export const formatMoney = (
  amountMinor: number,
  currency: Currency = "GHS",
  locale = "en-GH",
): string => {
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);

  return `${SYMBOLS[currency] ?? ""}${amount}`;
};
