"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { selectConsentPending } from "@/lib/features/consent/consentSlice";
import { useAppSelector } from "@/lib/store/hooks";

/** Chromium's install event; not in lib.dom yet and absent on iOS entirely. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "bb:install-dismissed-at";
const DISMISS_DAYS = 30;

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);

const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS predates display-mode and exposes this non-standard flag instead.
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const recentlyDismissed = (): boolean => {
  const raw = window.localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * Two code paths, because the platforms differ:
 * - Android/Chromium fires `beforeinstallprompt`, which we stash and replay
 *   from a real user gesture (the event is only valid once).
 * - iOS Safari has no API at all; the only option is instructions for
 *   Share → Add to Home Screen.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Both sit in the bottom corner. Two cards stacked there on a first visit is
  // one too many, and the cookie question is the one that has to be answered.
  const consentPending = useAppSelector(selectConsentPending);

  // Read through useSyncExternalStore rather than an effect: the value is
  // browser-only, and the server snapshot (false) keeps hydration consistent.
  const iosNeedsHint = useSyncExternalStore(
    useCallback(() => () => {}, []),
    useCallback(() => isIos() && !isStandalone() && !recentlyDismissed(), []),
    useCallback(() => false, []),
  );
  const showIosHint = iosNeedsHint && !dismissed;

  useEffect(() => {
    if (isIos() || isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      // Suppress Chrome's own mini-infobar so the prompt appears where it makes
      // sense in the funnel (after a product view, not on first paint).
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDeferred(null);
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // The event cannot be reused; Chrome fires a fresh one if it still applies.
    setDeferred(null);
  };

  if (consentPending) return null;
  if (!deferred && !showIosHint) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Body Biotics"
      className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <p className="text-sm font-medium">Add Body Biotics to your home screen</p>

      {showIosHint ? (
        <p className="mt-1 text-sm text-neutral-600">
          Tap the Share button, then “Add to Home Screen”.
        </p>
      ) : (
        <p className="mt-1 text-sm text-neutral-600">
          Faster launches, and you can browse the catalogue offline.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {!showIosHint && (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-2 text-sm text-neutral-600"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
