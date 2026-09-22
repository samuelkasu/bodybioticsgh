"use client";

import { selectIsOnline } from "@/lib/features/network/networkSlice";
import { useNetworkStatus } from "@/lib/features/network/useNetworkStatus";
import { useAppSelector } from "@/lib/store/hooks";

/**
 * Persistent, non-blocking status strip. In an installed PWA there is no
 * browser error page to fall back on, so the app itself has to say why a
 * checkout button is not working.
 */
export function OfflineBanner() {
  useNetworkStatus();
  const isOnline = useAppSelector(selectIsOnline);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black"
      // Clears the iOS notch when the app runs standalone.
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      You are offline. Browsing is available; orders will send once you reconnect.
    </div>
  );
}
