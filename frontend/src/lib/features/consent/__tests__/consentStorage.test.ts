import {
  ALL_ACCEPTED,
  CONSENT_VERSION,
  clearConsent,
  loadConsent,
  saveConsent,
} from "@/lib/features/consent/consentStorage";

const KEY = "bodybiotics:cookie-consent";

describe("cookie consent storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads back what was written", () => {
    saveConsent({ necessary: true, analytics: true, marketing: false });

    expect(loadConsent()?.preferences).toEqual({
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });

  it("treats a first visit as undecided", () => {
    expect(loadConsent()).toBeNull();
  });

  it("forces the necessary category on, whatever the caller passed", () => {
    saveConsent({ ...ALL_ACCEPTED, necessary: false });
    expect(loadConsent()?.preferences.necessary).toBe(true);
  });

  it("asks again when the stored answer predates the current categories", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: CONSENT_VERSION - 1,
        decidedAt: new Date().toISOString(),
        preferences: ALL_ACCEPTED,
      }),
    );

    expect(loadConsent()).toBeNull();
  });

  it("survives junk under its key", () => {
    window.localStorage.setItem(KEY, "not json");
    expect(loadConsent()).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION }));
    expect(loadConsent()?.preferences).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  it("does not throw when storage is blocked", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveConsent(ALL_ACCEPTED)).not.toThrow();
    setItem.mockRestore();
  });

  it("clears a stored answer", () => {
    saveConsent(ALL_ACCEPTED);
    clearConsent();
    expect(loadConsent()).toBeNull();
  });
});
