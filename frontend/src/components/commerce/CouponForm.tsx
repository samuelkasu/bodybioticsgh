"use client";

import { useState } from "react";

import { apiErrorMessage } from "@/lib/api/http";
import {
  useApplyCouponMutation,
  useRemoveCouponMutation,
} from "@/lib/features/cart/cartApi";
import { selectCartCouponCode, selectCartPricing } from "@/lib/features/cart/cartSlice";
import { useAppSelector } from "@/lib/store/hooks";

/**
 * The discount code box.
 *
 * It sends the code and shows whatever the server says. Nothing about what a
 * code is worth is decided here — the basket comes back re-priced, and the
 * refusal, when there is one, is the server's sentence rather than a generic
 * "invalid code" that leaves the customer guessing what to fix.
 */
export function CouponForm({ className }: { className?: string }) {
  const applied = useAppSelector(selectCartCouponCode);
  const { couponMessage } = useAppSelector(selectCartPricing);

  const [apply, { isLoading: isApplying }] = useApplyCouponMutation();
  const [remove, { isLoading: isRemoving }] = useRemoveCouponMutation();

  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const busy = isApplying || isRemoving;

  const onApply = async () => {
    setFailure(null);

    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setFailure("Enter a code.");
      return;
    }

    try {
      await apply(trimmed).unwrap();
      setCode("");
    } catch (error) {
      setFailure(apiErrorMessage(error, "That code could not be applied."));
    }
  };

  const onRemove = async () => {
    setFailure(null);
    try {
      await remove().unwrap();
    } catch (error) {
      setFailure(apiErrorMessage(error, "We could not remove that code."));
    }
  };

  if (applied) {
    return (
      <div className={className}>
        <div className="border-olive/40 bg-olive/10 rounded-control flex items-center justify-between gap-3 border px-4 py-3">
          <p className="min-w-0 text-sm">
            <span className="text-neutral-600">Code applied: </span>
            <span className="text-ink font-semibold tracking-wide">{applied}</span>
          </p>
          <button
            type="button"
            onClick={() => void onRemove()}
            disabled={busy}
            className="focus-ring shrink-0 text-sm underline underline-offset-4 disabled:opacity-50"
          >
            {isRemoving ? "Removing…" : "Remove"}
          </button>
        </div>
        {failure && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {failure}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {/*
        Collapsed by default. An empty code box beside a total is a standing
        suggestion that a cheaper price exists somewhere, and on a phone it is
        a row of screen spent on something most baskets do not use.
      */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-ring text-sm underline underline-offset-4"
        >
          Have a discount code?
        </button>
      ) : (
        // Deliberately not a <form>. This renders inside the checkout form,
        // and a nested form is invalid HTML that React refuses to hydrate.
        // Worse, without this the Enter key would submit the checkout form
        // and place the order while the customer was trying to apply a code.
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="coupon-code">
            Discount code
          </label>
          <input
            id="coupon-code"
            name="couponCode"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            // Enter still applies the code, as it would in a form of its own —
            // the default is stopped first so it cannot reach the checkout
            // form wrapped around this.
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void onApply();
            }}
            // Codes are printed upper-case and typed however; uppercasing as
            // they type means what is on screen matches the poster.
            onBlur={() => setCode((current) => current.trim().toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Discount code"
            disabled={busy}
            className="focus-ring border-card-line/80 text-ink rounded-card min-h-12 min-w-0 flex-1 border px-4 text-base tracking-wide uppercase"
          />
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={busy}
            className="focus-ring bg-ink hover:bg-cocoa rounded-card min-h-12 shrink-0 px-5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {isApplying ? "Applying…" : "Apply"}
          </button>
        </div>
      )}

      {/* The server's own reason, whether from this attempt or from a code it
          has just dropped because the basket changed under it. */}
      {(failure ?? couponMessage) && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {failure ?? couponMessage}
        </p>
      )}
    </div>
  );
}
