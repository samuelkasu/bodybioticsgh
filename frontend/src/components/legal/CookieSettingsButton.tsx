"use client";

import { consentReopened } from "@/lib/features/consent/consentSlice";
import { useAppDispatch } from "@/lib/store/hooks";

/**
 * The way back to the cookie notice once it has been answered. A consent choice
 * has to be as easy to withdraw as it was to give, and the footer is where
 * people look for it.
 */
export function CookieSettingsButton({ className }: { className?: string }) {
  const dispatch = useAppDispatch();

  return (
    <button
      type="button"
      onClick={() => dispatch(consentReopened())}
      className={className}
    >
      Cookie settings
    </button>
  );
}
