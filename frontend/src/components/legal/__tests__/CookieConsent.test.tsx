import { CookieConsent } from "@/components/legal/CookieConsent";
import { consentReopened } from "@/lib/features/consent/consentSlice";
import { loadConsent, saveConsent } from "@/lib/features/consent/consentStorage";
import { makeStore } from "@/lib/store/store";
import { act, fireEvent, renderWithProviders, screen } from "@/test/test-utils";

/** Past the entrance delay and any exit animation. */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
};

describe("CookieConsent", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const openBanner = async () => {
    const view = renderWithProviders(<CookieConsent />);
    await settle();
    return view;
  };

  it("stays out of the first paint, then arrives", async () => {
    renderWithProviders(<CookieConsent />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await settle();
    expect(screen.getByRole("dialog", { name: /cookies/i })).toBeInTheDocument();
  });

  it("never appears for a visitor who already answered", async () => {
    saveConsent({ necessary: true, analytics: true, marketing: false });
    await openBanner();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stores every category on accept, then leaves", async () => {
    await openBanner();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();

    expect(loadConsent()?.preferences).toEqual({
      necessary: true,
      analytics: true,
      marketing: true,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("records a refusal of the optional categories", async () => {
    await openBanner();

    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    await settle();

    expect(loadConsent()?.preferences).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  it("saves a per-category choice made in the panel", async () => {
    await openBanner();

    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /analytics/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    await settle();

    expect(loadConsent()?.preferences).toEqual({
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });

  it("keeps the essential switch locked on", async () => {
    await openBanner();
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));

    const essential = screen.getByRole("checkbox", { name: /essential/i });
    expect(essential).toBeChecked();
    expect(essential).toBeDisabled();
  });

  it("comes back from the footer showing what is in force", async () => {
    saveConsent({ necessary: true, analytics: true, marketing: false });

    const store = makeStore();
    renderWithProviders(<CookieConsent />, { store });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      store.dispatch(consentReopened());
    });
    await settle();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /analytics/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /marketing/i })).not.toBeChecked();
  });
});
