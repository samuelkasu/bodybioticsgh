"use client";

import { MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { MAX_QUANTITY_PER_LINE } from "@/lib/features/cart/cartSlice";

export type QuantityStepperProps = {
  quantity: number;
  onChange: (quantity: number) => void;
  label: string;
  disabled?: boolean;
  max?: number;
};

/**
 * Buttons rather than a bare number input: on a phone, stepping is one tap and
 * a numeric keyboard is not. The input remains for typing a larger figure.
 */
export function QuantityStepper({
  quantity,
  onChange,
  label,
  disabled = false,
  max = MAX_QUANTITY_PER_LINE,
}: QuantityStepperProps) {
  const clamp = (value: number) => Math.min(Math.max(value, 0), max);

  return (
    // Faces from the original product page: white ± keys either side of an
    // #F9F9F9 field, hairline #E4E4E4, 10px on the outer corners. The ring
    // sits on the whole control rather than on the number field, so keyboard
    // focus reads as one component instead of a box round the digits — olive,
    // like every other focus state on the site, not the browser's black.
    <div className="focus-within:ring-olive/70 focus-within:ring-offset-cream rounded-card inline-flex items-center transition-shadow focus-within:ring-2 focus-within:ring-offset-2">
      <button
        type="button"
        aria-label={`Decrease quantity of ${label}`}
        disabled={disabled || quantity <= 0}
        onClick={() => onChange(clamp(quantity - 1))}
        className="rounded-l-control flex h-9 w-9 items-center justify-center border border-[#e4e4e4] bg-white text-[#9a9a9a] transition-colors hover:bg-[#eeeeee] hover:text-[#2b2b2b] focus-visible:outline-none disabled:text-[#e4e4e4] disabled:hover:bg-white"
      >
        <MinusIcon className="h-3.5 w-3.5" />
      </button>

      <label className="sr-only" htmlFor={`qty-${label}`}>
        Quantity for {label}
      </label>
      <input
        id={`qty-${label}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={quantity}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value.trim();
          // An empty field is mid-edit, not a request to remove the line.
          if (raw === "") return;
          onChange(clamp(Number(raw)));
        }}
        // The native spinner arrows duplicate the two keys either side of it
        // and crowd a 40px field.
        className="caret-olive h-9 w-10 appearance-none border-y border-[#e4e4e4] bg-[#f9f9f9] text-center text-sm font-medium text-[#101010] tabular-nums outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        aria-label={`Increase quantity of ${label}`}
        disabled={disabled || quantity >= max}
        onClick={() => onChange(clamp(quantity + 1))}
        className="rounded-r-control flex h-9 w-9 items-center justify-center border border-[#e4e4e4] bg-white text-[#9a9a9a] transition-colors hover:bg-[#eeeeee] hover:text-[#2b2b2b] focus-visible:outline-none disabled:text-[#e4e4e4] disabled:hover:bg-white"
      >
        <PlusIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
