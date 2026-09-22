"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CookieIcon } from "@/components/ui/Icons";
import {
  consentDecided,
  consentHydrated,
  consentPanelToggled,
  selectConsentPanelOpen,
  selectConsentPreferences,
  selectConsentRecord,
  selectConsentVisible,
} from "@/lib/features/consent/consentSlice";
import {
  ALL_ACCEPTED,
  loadConsent,
  NECESSARY_ONLY,
  type ConsentCategory,
  type ConsentPreferences,
} from "@/lib/features/consent/consentStorage";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

/**
 * Long enough for the splash to clear and the first screen to settle, so the
 * card arrives at a page the visitor is already looking at rather than racing
 * the hero into view.
 */
const FIRST_ASK_DELAY_MS = 900;

/** Matches the consent-out keyframe; the card unmounts when it finishes. */
const EXIT_MS = 260;

type Category = {
  key: ConsentCategory;
  title: string;
  description: string;
  locked?: boolean;
};

/**
 * Written to match what the shop actually does, not to a template. Claiming
 * categories we do not run would be its own kind of dark pattern, so the two
 * optional rows say plainly that nothing is using them yet — and the switches
 * are real, so they still mean something the day one is.
 */
const CATEGORIES: Category[] = [
  {
    key: "necessary",
    title: "Essential",
    description:
      "Keeps you signed in and remembers your basket between pages. The shop cannot work without these, so they stay on.",
    locked: true,
  },
  {
    key: "analytics",
    title: "Analytics",
    description:
      "Anonymous counts of which pages and products get opened, so we can fix what is slow or confusing. We run none today.",
  },
  {
    key: "marketing",
    title: "Marketing",
    description:
      "Would let us tell whether an advert or a shared link led to an order. We run no advertising trackers today.",
  },
];

/**
 * The cookie notice, and the only place a visitor can change that answer later.
 *
 * It is a corner card rather than a full-width bar across a blocked page: the
 * only cookies this site sets are strictly necessary, so holding the catalogue
 * hostage behind an "Accept" would be theatre. Declining is one tap, the same
 * size and weight as accepting — a greyed-out "reject" buried under a link is
 * what regulators call a dark pattern, and it is not what this does.
 *
 * Nothing renders on the server. The answer lives in localStorage, which only
 * exists in the browser, so the banner appears after mount; rendering it in the
 * SSR markup would be a hydration mismatch and would flash for visitors who
 * answered months ago.
 */
export function CookieConsent() {
  const dispatch = useAppDispatch();
  const visible = useAppSelector(selectConsentVisible);
  const panelOpen = useAppSelector(selectConsentPanelOpen);
  const stored = useAppSelector(selectConsentPreferences);
  const record = useAppSelector(selectConsentRecord);

  /** Flipped once by the entrance timer; a reopen shows the card immediately. */
  const [delayPassed, setDelayPassed] = useState(false);
  /** The choice being animated out; applied once the card has left. */
  const [pending, setPending] = useState<ConsentPreferences | null>(null);
  /**
   * Unsaved switch positions, tagged with the stored answer they were taken
   * from. Storing the origin rather than syncing in an effect means a saved
   * choice re-seeds the panel by itself, with no second render.
   */
  const [edit, setEdit] = useState<{
    from: ConsentPreferences;
    value: ConsentPreferences;
  } | null>(null);

  const draft = edit && edit.from === stored ? edit.value : stored;

  const cardRef = useRef<HTMLDivElement>(null);
  const announced = useRef(false);

  useEffect(() => {
    dispatch(consentHydrated(loadConsent()));
  }, [dispatch]);

  // Reopened from the footer the visitor is already waiting, so only the first
  // ask is held back.
  const ready = delayPassed || panelOpen;

  useEffect(() => {
    if (!visible || panelOpen || delayPassed) return;
    const timer = setTimeout(() => setDelayPassed(true), FIRST_ASK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [delayPassed, panelOpen, visible]);

  // The card leaves the DOM only after it has animated out, so the decision is
  // held locally first and dispatched second — dispatching straight away would
  // unmount it mid-animation and it would blink off.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      dispatch(consentDecided(pending));
      setPending(null);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [dispatch, pending]);

  // Focus moves to the card only when it was opened deliberately from the
  // footer. On the first ask it must not steal focus from whatever the visitor
  // is already reading.
  useEffect(() => {
    if (!visible || !ready) {
      announced.current = false;
      return;
    }
    if (announced.current) return;
    announced.current = true;
    if (panelOpen) cardRef.current?.focus();
  }, [panelOpen, ready, visible]);

  // Escape closes the settings, but only once an answer exists. Before that
  // there is nothing to fall back to, and a key press is not a decision.
  useEffect(() => {
    if (!visible || !ready || !record) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch(consentPanelToggled(false));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, ready, record, visible]);

  const exiting = pending !== null;
  if (!exiting && (!visible || !ready)) return null;

  const decide = (preferences: ConsentPreferences) => setPending(preferences);

  const setCategory = (key: ConsentCategory, value: boolean) =>
    setEdit({ from: stored, value: { ...draft, [key]: value } });

  return (
    <div
      // Bottom-left on a desktop so it never covers the cart drawer's controls
      // on the right; centred and full width on a phone, where the thumb is.
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3 pb-3 sm:justify-start sm:px-6 sm:pb-6"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        // Not modal: the notice explains two strictly necessary cookies, so
        // there is no reason to trap a customer inside it.
        aria-modal="false"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-copy"
        className={`${exiting ? "consent-out" : "consent-in"} border-card-line bg-card/95 text-ink pointer-events-auto w-full max-w-md rounded-2xl border shadow-[0_18px_44px_-16px_rgba(16,16,16,0.45)] backdrop-blur focus:outline-none`}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="bg-olive flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
            <CookieIcon className="h-[18px] w-[18px]" />
          </span>

          <div className="min-w-0">
            <h2 id="cookie-consent-title" className="text-lg leading-tight">
              A word about cookies
            </h2>
            <p
              id="cookie-consent-copy"
              className="text-cocoa mt-1.5 text-sm leading-relaxed"
            >
              Two essential cookies keep you signed in and hold your basket together.
              Nothing optional runs unless you switch it on. Our{" "}
              <Link href="/privacy" className="font-medium underline underline-offset-2">
                privacy policy
              </Link>{" "}
              sets out the detail.
            </p>
          </div>
        </div>

        {/*
          0fr → 1fr rather than a measured pixel height: the rows wrap
          differently on a narrow phone, and a height measured once would clip
          them after a rotation.
        */}
        <div
          id="cookie-consent-panel"
          className={`grid px-5 transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
            panelOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="border-card-line divide-card-line divide-y rounded-xl border bg-white/60">
              {CATEGORIES.map((category) => (
                <li key={category.key} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{category.title}</p>
                    <p className="text-taupe mt-0.5 text-xs leading-relaxed">
                      {category.description}
                    </p>
                  </div>

                  <ConsentSwitch
                    label={`${category.title} cookies`}
                    checked={draft[category.key]}
                    disabled={category.locked}
                    // Inert while the panel is shut: a switch inside a
                    // zero-height row is still tabbable otherwise.
                    tabbable={panelOpen}
                    onChange={(value) => setCategory(category.key, value)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 px-5 pb-5 sm:flex-row sm:items-center">
          <Button
            variant="olive"
            size="sm"
            className="sm:flex-1"
            onClick={() => decide(ALL_ACCEPTED)}
          >
            Accept all
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="sm:flex-1"
            onClick={() => decide(panelOpen ? draft : NECESSARY_ONLY)}
          >
            {panelOpen ? "Save choices" : "Essential only"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-expanded={panelOpen}
            aria-controls="cookie-consent-panel"
            onClick={() => dispatch(consentPanelToggled(!panelOpen))}
          >
            {panelOpen ? "Hide" : "Choose"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A real checkbox under a drawn track, so it is announced as a checkbox, works
 * with the space bar and survives a stylesheet failing to load.
 */
function ConsentSwitch({
  label,
  checked,
  disabled = false,
  tabbable,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  tabbable: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none ${
        checked ? "bg-olive" : "bg-sand-deep"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        tabIndex={tabbable && !disabled ? undefined : -1}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none ml-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out motion-reduce:transition-none ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
      {/* The ring belongs to the track, not to the hidden input. */}
      <span className="peer-focus-visible:outline-olive pointer-events-none absolute inset-0 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2" />
    </label>
  );
}
