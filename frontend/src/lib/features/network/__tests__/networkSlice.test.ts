import {
  connectionChanged,
  networkReducer,
  onlineStatusChanged,
  selectIsLowBandwidth,
  selectIsOnline,
  selectUpdateAvailable,
  updateAvailable,
  type NetworkState,
} from "@/lib/features/network/networkSlice";
import type { RootState } from "@/lib/store/store";

const stateWith = (network: NetworkState): RootState => ({ network }) as RootState;

const initial: NetworkState = {
  isOnline: true,
  quality: "unknown",
  saveData: false,
  updateAvailable: false,
};

describe("networkSlice", () => {
  it("assumes online before the client reports otherwise", () => {
    expect(networkReducer(undefined, { type: "@@init" })).toEqual(initial);
  });

  it("tracks online and offline transitions", () => {
    const offline = networkReducer(initial, onlineStatusChanged(false));
    expect(selectIsOnline(stateWith(offline))).toBe(false);

    const back = networkReducer(offline, onlineStatusChanged(true));
    expect(selectIsOnline(stateWith(back))).toBe(true);
  });

  it("flags low bandwidth on a slow connection", () => {
    const slow = networkReducer(
      initial,
      connectionChanged({ quality: "slow", saveData: false }),
    );
    expect(selectIsLowBandwidth(stateWith(slow))).toBe(true);
  });

  it("flags low bandwidth when Data Saver is on, even on a fast link", () => {
    const saver = networkReducer(
      initial,
      connectionChanged({ quality: "fast", saveData: true }),
    );
    expect(selectIsLowBandwidth(stateWith(saver))).toBe(true);
  });

  it("does not flag low bandwidth on an unknown connection", () => {
    // Safari reports nothing; guessing "slow" would degrade every iOS user.
    expect(selectIsLowBandwidth(stateWith(initial))).toBe(false);
  });

  it("records a waiting service worker update", () => {
    const pending = networkReducer(initial, updateAvailable(true));
    expect(selectUpdateAvailable(stateWith(pending))).toBe(true);
    expect(
      selectUpdateAvailable(stateWith(networkReducer(pending, updateAvailable(false)))),
    ).toBe(false);
  });
});
