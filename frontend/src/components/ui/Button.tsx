import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "olive" | "outline" | "sand" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Shapes and type taken from the original's CSS, not guessed:
 *   buttons   Inter Tight 16px/500, border-radius 10px, padding 14px 20px
 *   cart CTA  Inter 14px/600, uppercase, letter-spacing 0.3px
 * They are rounded rectangles, not pills — a pill reads as a different brand.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:bg-cocoa disabled:bg-taupe-soft disabled:text-white/70",
  // The catalogue grid's "ADD TO CART": deep olive, not black.
  olive:
    "bg-olive text-white hover:bg-cocoa disabled:bg-taupe-soft disabled:text-white/70",
  outline:
    "border border-ink text-ink hover:bg-ink hover:text-white disabled:border-taupe-soft disabled:text-taupe-soft",
  sand: "bg-sand text-cocoa-deep hover:bg-sand-deep disabled:bg-sand/50",
  ghost: "text-ink hover:bg-sand/40 disabled:text-taupe-soft",
  danger: "text-red-700 hover:bg-red-50 disabled:text-taupe-soft",
};

// Every size clears 44px so a thumb can hit it.
const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-5 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-13 px-6 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Uppercase, tracked label — the original's "ADD TO CART" treatment. */
  uppercase?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  uppercase = false,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // active:scale gives a press the same tactile confirmation a native
        // control has; motion-reduce drops it for anyone who asked.
        "focus-ring rounded-card inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,border-color,transform] duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 motion-reduce:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        uppercase && "text-sm font-semibold tracking-[0.3px] uppercase",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
