import {
  selectToasts,
  toastDismissed,
  toastReducer,
  toastShown,
  type Toast,
} from "@/lib/features/ui/toastSlice";
import type { RootState } from "@/lib/store/store";

const stateWith = (items: Toast[]) => ({ toasts: { items } }) as RootState;

const reduce = (actions: ReturnType<typeof toastShown>[]) =>
  actions.reduce(toastReducer, undefined as never);

describe("toasts", () => {
  it("shows a message with an action link", () => {
    const state = reduce([
      toastShown("Glow Serum added to your cart.", {
        action: { label: "View cart", href: "/cart" },
      }),
    ]);

    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.message).toBe("Glow Serum added to your cart.");
    expect(state.items[0]?.action?.href).toBe("/cart");
    expect(state.items[0]?.tone).toBe("success");
  });

  it("refreshes a repeat instead of stacking it", () => {
    // Tapping "Add to cart" four times in a row is a real thing people do on a
    // slow connection; four identical cards would push the newest off-screen.
    const state = reduce([
      toastShown("Added."),
      toastShown("Added."),
      toastShown("Added."),
    ]);

    expect(state.items).toHaveLength(1);
  });

  it("keeps only the newest few", () => {
    const state = reduce([
      toastShown("One"),
      toastShown("Two"),
      toastShown("Three"),
      toastShown("Four"),
    ]);

    expect(state.items.map((toast) => toast.message)).toEqual(["Two", "Three", "Four"]);
  });

  it("does not collapse a failure into the success above it", () => {
    const state = reduce([toastShown("Added."), toastShown("Added.", { tone: "error" })]);

    expect(state.items).toHaveLength(2);
  });

  it("dismisses one without touching the others", () => {
    const shown = reduce([toastShown("One"), toastShown("Two")]);
    const first = shown.items[0]!;

    const state = toastReducer(shown, toastDismissed(first.id));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.message).toBe("Two");
  });

  it("ignores a dismissal that has already happened", () => {
    const shown = reduce([toastShown("One")]);
    const once = toastReducer(shown, toastDismissed(shown.items[0]!.id));

    // The auto-dismiss timer and a tap on the close button can both fire.
    expect(toastReducer(once, toastDismissed(shown.items[0]!.id)).items).toHaveLength(0);
  });

  it("selects out of the store", () => {
    expect(selectToasts(stateWith([]))).toEqual([]);
  });
});
