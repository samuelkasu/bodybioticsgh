import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/lib/store/store";

/** Coarse buckets from the Network Information API, where it exists. */
export type ConnectionQuality = "unknown" | "slow" | "fast";

export type NetworkState = {
  isOnline: boolean;
  quality: ConnectionQuality;
  saveData: boolean;
  /** Set when a new service worker is waiting to take over. */
  updateAvailable: boolean;
};

const initialState: NetworkState = {
  // Assume online during SSR: rendering the offline banner on the server would
  // flash it for every first-time visitor.
  isOnline: true,
  quality: "unknown",
  saveData: false,
  updateAvailable: false,
};

const networkSlice = createSlice({
  name: "network",
  initialState,
  reducers: {
    onlineStatusChanged(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    connectionChanged(
      state,
      action: PayloadAction<{ quality: ConnectionQuality; saveData: boolean }>,
    ) {
      state.quality = action.payload.quality;
      state.saveData = action.payload.saveData;
    },
    updateAvailable(state, action: PayloadAction<boolean>) {
      state.updateAvailable = action.payload;
    },
  },
});

export const { onlineStatusChanged, connectionChanged, updateAvailable } =
  networkSlice.actions;

export const networkReducer = networkSlice.reducer;

export const selectNetwork = (state: RootState): NetworkState => state.network;

export const selectIsOnline = createSelector(
  [selectNetwork],
  (network) => network.isOnline,
);

/**
 * True when the user is on a metered/slow link or has Data Saver on. Gate
 * heavy work on this: autoplay video, prefetching the full catalogue, hi-res
 * hero images.
 */
export const selectIsLowBandwidth = createSelector(
  [selectNetwork],
  (network) => network.saveData || network.quality === "slow",
);

export const selectUpdateAvailable = createSelector(
  [selectNetwork],
  (network) => network.updateAvailable,
);
