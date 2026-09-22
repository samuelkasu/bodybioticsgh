"use client";

import { useEffect } from "react";

import {
  connectionChanged,
  onlineStatusChanged,
  type ConnectionQuality,
} from "@/lib/features/network/networkSlice";
import { useAppDispatch } from "@/lib/store/hooks";

/** Chromium-only API; absent on Safari/iOS, hence the optional typing. */
type NetworkInformation = {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

const readConnection = (): NetworkInformation | undefined =>
  (navigator as Navigator & { connection?: NetworkInformation }).connection;

const toQuality = (effectiveType?: string): ConnectionQuality => {
  if (!effectiveType) return "unknown";
  return effectiveType === "4g" ? "fast" : "slow";
};

/**
 * Mounted once, near the root. `navigator.onLine` only proves the radio is up,
 * not that the API is reachable — treat it as a hint and still handle fetch
 * failures where they happen.
 */
export function useNetworkStatus(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const syncOnline = () => dispatch(onlineStatusChanged(navigator.onLine));
    const syncConnection = () => {
      const connection = readConnection();
      dispatch(
        connectionChanged({
          quality: toQuality(connection?.effectiveType),
          saveData: connection?.saveData ?? false,
        }),
      );
    };

    syncOnline();
    syncConnection();

    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    const connection = readConnection();
    connection?.addEventListener?.("change", syncConnection);

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      connection?.removeEventListener?.("change", syncConnection);
    };
  }, [dispatch]);
}
