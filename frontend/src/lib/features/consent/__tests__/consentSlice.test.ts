import {
  consentHydrated,
  consentPanelToggled,
  consentReducer,
  consentReopened,
  consentStored,
  hasConsent,
  selectConsentPending,
  selectConsentPreferences,
  selectConsentVisible,
  type ConsentState,
} from "@/lib/features/consent/consentSlice";
import {
  ALL_ACCEPTED,
  CONSENT_VERSION,
  type ConsentRecord,
} from "@/lib/features/consent/consentStorage";
import type { RootState } from "@/lib/store/store";

const stateWith = (consent: ConsentState): RootState => ({ consent }) as RootState;

const initial: ConsentState = { hydrated: false, record: null, panelOpen: false };

const accepted: ConsentRecord = {
  version: CONSENT_VERSION,
  decidedAt: "2026-09-20T10:00:00.000Z",
  preferences: ALL_ACCEPTED,
};

describe("consentSlice", () => {
  it("starts undecided and invisible, so nothing renders on the server", () => {
    expect(consentReducer(undefined, { type: "@@init" })).toEqual(initial);
    expect(selectConsentVisible(stateWith(initial))).toBe(false);
    expect(selectConsentPending(stateWith(initial))).toBe(false);
  });

  it("shows the banner once storage says the visitor never answered", () => {
    const state = consentReducer(initial, consentHydrated(null));
    expect(selectConsentVisible(stateWith(state))).toBe(true);
    expect(selectConsentPending(stateWith(state))).toBe(true);
  });

  it("stays hidden for a visitor who already answered", () => {
    const state = consentReducer(initial, consentHydrated(accepted));
    expect(selectConsentVisible(stateWith(state))).toBe(false);
    expect(selectConsentPending(stateWith(state))).toBe(false);
  });

  it("hides the banner and closes the panel once a choice is stored", () => {
    let state = consentReducer(initial, consentHydrated(null));
    state = consentReducer(state, consentPanelToggled(true));
    state = consentReducer(state, consentStored(accepted));

    expect(state.panelOpen).toBe(false);
    expect(selectConsentVisible(stateWith(state))).toBe(false);
  });

  it("brings the banner back from the footer with the categories open", () => {
    let state = consentReducer(initial, consentHydrated(accepted));
    state = consentReducer(state, consentReopened());

    expect(state.panelOpen).toBe(true);
    expect(selectConsentVisible(stateWith(state))).toBe(true);
    // Reopening is not un-deciding: other bottom sheets stay allowed.
    expect(selectConsentPending(stateWith(state))).toBe(false);
  });

  it("defaults to essential-only until something is accepted", () => {
    const state = consentReducer(initial, consentHydrated(null));
    expect(selectConsentPreferences(stateWith(state))).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
    expect(hasConsent(stateWith(state), "analytics")).toBe(false);
  });

  it("reports the stored answer per category", () => {
    const partial: ConsentRecord = {
      ...accepted,
      preferences: { necessary: true, analytics: true, marketing: false },
    };
    const state = consentReducer(initial, consentHydrated(partial));

    expect(hasConsent(stateWith(state), "analytics")).toBe(true);
    expect(hasConsent(stateWith(state), "marketing")).toBe(false);
  });
});
