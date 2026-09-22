"use client";

import { selectUpdateAvailable } from "@/lib/features/network/networkSlice";
import { useAppSelector } from "@/lib/store/hooks";

/**
 * An installed PWA never "reloads" on its own, so without this a customer can
 * sit on a build from weeks ago — with stale prices — indefinitely.
 */
export function UpdatePrompt() {
  const hasUpdate = useAppSelector(selectUpdateAvailable);

  if (!hasUpdate) return null;

  const applyUpdate = async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    // The new worker claims clients on activation; reloading picks up the new
    // shell in one step instead of leaving a mixed-version page.
    window.location.reload();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <span>A new version is available.</span>
      <button
        type="button"
        onClick={() => void applyUpdate()}
        className="rounded-lg bg-white px-3 py-1.5 font-medium text-neutral-900"
      >
        Refresh
      </button>
    </div>
  );
}
