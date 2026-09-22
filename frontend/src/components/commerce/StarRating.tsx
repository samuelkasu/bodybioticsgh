"use client";

import { HalfStarIcon, StarIcon } from "@/components/ui/Icons";

export type StarRatingProps = {
  /** 0–5, halves allowed: 4.3 draws four filled stars and a half. */
  value: number;
  className?: string;
  size?: "sm" | "md";
};

const SIZES = { sm: "h-4 w-4", md: "h-5 w-5" } as const;

/** Read-only rating display. The input version is StarRatingInput. */
export function StarRating({ value, className, size = "sm" }: StarRatingProps) {
  const rounded = Math.round(value * 2) / 2;
  const box = SIZES[size];

  return (
    <span
      className={`text-gold inline-flex items-center gap-0.5 ${className ?? ""}`}
      role="img"
      aria-label={`Rated ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        if (rounded >= star) return <StarIcon key={star} className={box} />;
        if (rounded + 0.5 >= star) return <HalfStarIcon key={star} className={box} />;
        return <StarIcon key={star} filled={false} className={`${box} opacity-40`} />;
      })}
    </span>
  );
}

export type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  /** Rendered as the radio group's accessible name. */
  label: string;
  disabled?: boolean;
};

/**
 * Radios rather than buttons: arrow keys move through the scale, the value
 * posts with the form, and a screen reader announces "3 of 5" without help.
 */
export function StarRatingInput({
  value,
  onChange,
  label,
  disabled = false,
}: StarRatingInputProps) {
  return (
    <fieldset className="flex items-center gap-1" disabled={disabled}>
      <legend className="sr-only">{label}</legend>

      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          // has-[:focus-visible], not focus-within: clicking a star used to
          // draw a square box round it, because a click focuses the radio too.
          // A keyboard user still gets a ring; a mouse user gets the fill.
          className="has-[:focus-visible]:outline-gold rounded-control cursor-pointer p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
        >
          <input
            type="radio"
            name="rating"
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <span className="sr-only">
            {star} {star === 1 ? "star" : "stars"}
          </span>
          <StarIcon
            aria-hidden="true"
            filled={star <= value}
            className={`h-7 w-7 transition-colors ${
              star <= value ? "text-gold" : "text-taupe-soft/50"
            }`}
          />
        </label>
      ))}
    </fieldset>
  );
}
