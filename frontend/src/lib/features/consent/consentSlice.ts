import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  NECESSARY_ONLY,
  saveConsent,
  type ConsentCategory,
  type ConsentPreferences,
  type ConsentRecord,
} from "@/lib/features/consent/consentStorage";
import type { AppThunk, RootState } from "@/lib/store/store";

export type ConsentState = {
  /** False until the browser's stored answer has been read. */
  hydrated: boolean;
  /** null means the visitor has never answered for this consent version. */
  record: ConsentRecord | null;
  /** The category list is showing, either on first ask or reopened later. */
  panelOpen: boolean;
};

const initialState: ConsentState = {
  // Storage is browser-only, so the server renders as "not yet known" and the
  // banner stays out of the SSR markup. Anything else is a hydration mismatch.
  hydrated: false,
  record: null,
  panelOpen: false,
};

const consentSlice = createSlice({
  name: "consent",
  initialState,
  reducers: {
    consentHydrated(state, action: PayloadAction<ConsentRecord | null>) {
      state.hydrated = true;
      state.record = action.payload;
    },
    consentStored(state, action: PayloadAction<ConsentRecord>) {
      state.record = action.payload;
      state.panelOpen = false;
    },
    consentPanelToggled(state, action: PayloadAction<boolean>) {
      state.panelOpen = action.payload;
    },
    /** Footer "Cookie settings": bring the banner back with the list open. */
    consentReopened(state) {
      state.hydrated = true;
      state.panelOpen = true;
    },
  },
});

export const { consentHydrated, consentStored, consentPanelToggled, consentReopened } =
  consentSlice.actions;

export const consentReducer = consentSlice.reducer;

/** Writes the choice to the device, then puts it in the store. */
export const consentDecided =
  (preferences: ConsentPreferences): AppThunk =>
  (dispatch) => {
    dispatch(consentStored(saveConsent(preferences)));
  };

const selectConsent = (state: RootState): ConsentState => state.consent;

export const selectConsentRecord = createSelector(
  [selectConsent],
  (consent) => consent.record,
);

export const selectConsentPanelOpen = createSelector(
  [selectConsent],
  (consent) => consent.panelOpen,
);

/** The visitor has not answered yet — used to hold back other bottom sheets. */
export const selectConsentPending = createSelector(
  [selectConsent],
  (consent) => consent.hydrated && consent.record === null,
);

export const selectConsentVisible = createSelector(
  [selectConsent],
  (consent) => consent.hydrated && (consent.record === null || consent.panelOpen),
);

/** Falls back to essential-only, so nothing optional runs before a yes. */
export const selectConsentPreferences = createSelector(
  [selectConsentRecord],
  (record): ConsentPreferences => record?.preferences ?? NECESSARY_ONLY,
);

/**
 * Gate optional work on this rather than on the record existing: an accepted
 * banner with analytics switched off is still a no.
 */
export const hasConsent = (state: RootState, category: ConsentCategory): boolean =>
  selectConsentPreferences(state)[category];
