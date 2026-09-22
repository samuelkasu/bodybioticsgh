import { CartDrawer } from "@/components/layout/CartDrawer";
import { cartToggled } from "@/lib/features/cart/cartSlice";
import { makeStore } from "@/lib/store/store";
import { act, fireEvent, renderWithProviders, screen } from "@/test/test-utils";

jest.mock("next/navigation", () => ({ usePathname: () => "/shop" }));

/**
 * The drawer mounts, then flips `shown` a frame later so the slide has
 * something to transition from. Focus lands after that, so tests have to let
 * both frames run.
 */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

describe("CartDrawer focus management", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // jsdom has no rAF timing of its own worth relying on; drive it off the
    // fake timers so the two nested frames actually run.
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        const id = setTimeout(() => callback(performance.now()), 0);
        return id as unknown as number;
      });
    // Paired with the above: the component cancels its frames on cleanup, and
    // fake timers refuse a setTimeout id handed to cancelAnimationFrame.
    jest
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id: number) => clearTimeout(id as unknown as NodeJS.Timeout));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const open = async () => {
    const store = makeStore();
    const view = renderWithProviders(<CartDrawer />, { store });
    act(() => {
      store.dispatch(cartToggled(true));
    });
    await settle();
    return { store, view };
  };

  it("moves focus into the panel when it opens", async () => {
    await open();

    // Without this a keyboard user's focus is still behind the scrim, on a
    // page they can no longer see.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /close cart/i }),
    );
  });

  it("holds Tab inside the dialog", async () => {
    await open();

    const panel = screen.getByRole("dialog");
    const focusable = panel.querySelectorAll<HTMLElement>("a[href], button");
    const last = focusable[focusable.length - 1]!;

    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });

    // aria-modal promises the rest of the page is unreachable; tabbing off the
    // last control has to wrap rather than walk out behind the scrim.
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("wraps backwards off the first control too", async () => {
    await open();

    const panel = screen.getByRole("dialog");
    const first = panel.querySelector<HTMLElement>("button")!;

    first.focus();
    fireEvent.keyDown(window, { key: "Shift", shiftKey: true });
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape", async () => {
    const { store } = await open();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(store.getState().cart.isOpen).toBe(false);
  });

  it("offers a way out of an empty cart", async () => {
    await open();

    // An empty drawer that only says "no products" is a dead end the customer
    // has to close and navigate around.
    expect(screen.getByRole("link", { name: /start shopping/i })).toHaveAttribute(
      "href",
      "/shop",
    );
  });
});
