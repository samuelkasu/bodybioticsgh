import {
  MAX_QUANTITY_PER_LINE,
  cartCleared,
  cartReducer,
  cartToggled,
  itemAdded,
  itemRemoved,
  quantitySet,
  selectCartItemCount,
  selectCartSubtotalMinor,
  selectHasUnavailableLines,
  type CartState,
} from "@/lib/features/cart/cartSlice";
import type { RootState } from "@/lib/store/store";
import { makeProduct } from "@/test/fixtures";

const product = makeProduct();
const otherProduct = makeProduct({
  id: "p2",
  slug: "night-cream",
  name: "Night Cream",
  priceMinor: 9_900,
});

const emptyState: CartState = {
  lines: {},
  pricing: {
    discountMinor: 0,
    couponCode: null,
    discounts: [],
    freeDeliveryGranted: false,
    couponMessage: null,
  },
  isOpen: false,
  isSyncing: false,
};

const stateWith = (cart: CartState): RootState => ({ cart }) as RootState;

describe("cartSlice", () => {
  it("returns the initial state for an unknown action", () => {
    expect(cartReducer(undefined, { type: "@@init/unknown" })).toEqual(emptyState);
  });

  it("adds an item with a default quantity of 1", () => {
    const state = cartReducer(emptyState, itemAdded(product));
    expect(state.lines["p1"]?.quantity).toBe(1);
    expect(state.lines["p1"]?.unitPriceMinor).toBe(12_500);
  });

  it("accumulates quantity when the same product is added twice", () => {
    let state = cartReducer(emptyState, itemAdded(product, 2));
    state = cartReducer(state, itemAdded(product, 3));
    expect(state.lines["p1"]?.quantity).toBe(5);
  });

  it("caps quantity at the per-line maximum", () => {
    const state = cartReducer(emptyState, itemAdded(product, 500));
    expect(state.lines["p1"]?.quantity).toBe(MAX_QUANTITY_PER_LINE);
  });

  it("drops the line when a non-positive quantity is added", () => {
    expect(cartReducer(emptyState, itemAdded(product, 0)).lines["p1"]).toBeUndefined();
  });

  it("rolls an optimistic add back with a negative quantity", () => {
    // AddToCartButton does exactly this when the request fails.
    const added = cartReducer(emptyState, itemAdded(product, 2));
    const rolledBack = cartReducer(added, itemAdded(product, -2));

    expect(rolledBack.lines["p1"]).toBeUndefined();
  });

  it("removes the line when quantity is set to 0 or below", () => {
    const withItem = cartReducer(emptyState, itemAdded(product, 2));
    expect(
      cartReducer(withItem, quantitySet({ productId: "p1", quantity: 0 })).lines["p1"],
    ).toBeUndefined();
    expect(
      cartReducer(withItem, quantitySet({ productId: "p1", quantity: -4 })).lines["p1"],
    ).toBeUndefined();
  });

  it("ignores quantitySet for a product that is not in the cart", () => {
    const state = cartReducer(
      emptyState,
      quantitySet({ productId: "ghost", quantity: 3 }),
    );
    expect(state).toEqual(emptyState);
  });

  it("ignores NaN quantities by dropping the line rather than corrupting state", () => {
    const withItem = cartReducer(emptyState, itemAdded(product, 2));
    const state = cartReducer(
      withItem,
      quantitySet({ productId: "p1", quantity: Number.NaN }),
    );
    expect(state.lines["p1"]).toBeUndefined();
  });

  it("truncates fractional quantities", () => {
    const withItem = cartReducer(emptyState, itemAdded(product, 1));
    const state = cartReducer(withItem, quantitySet({ productId: "p1", quantity: 2.7 }));
    expect(state.lines["p1"]?.quantity).toBe(2);
  });

  it("removes a single line and clears the whole cart", () => {
    let state = cartReducer(emptyState, itemAdded(product));
    state = cartReducer(state, itemAdded(otherProduct));

    const afterRemove = cartReducer(state, itemRemoved("p1"));
    expect(afterRemove.lines["p1"]).toBeUndefined();
    expect(afterRemove.lines["p2"]).toBeDefined();

    expect(cartReducer(state, cartCleared()).lines).toEqual({});
  });

  it("toggles the drawer, honouring an explicit value", () => {
    expect(cartReducer(emptyState, cartToggled(undefined)).isOpen).toBe(true);
    expect(cartReducer({ ...emptyState, isOpen: true }, cartToggled(false)).isOpen).toBe(
      false,
    );
  });
});

describe("cart selectors", () => {
  it("counts items and sums the subtotal across lines", () => {
    let state = cartReducer(emptyState, itemAdded(product, 2));
    state = cartReducer(state, itemAdded(otherProduct, 3));

    expect(selectCartItemCount(stateWith(state))).toBe(5);
    expect(selectCartSubtotalMinor(stateWith(state))).toBe(12_500 * 2 + 9_900 * 3);
  });

  it("returns zero totals for an empty cart", () => {
    expect(selectCartItemCount(stateWith(emptyState))).toBe(0);
    expect(selectCartSubtotalMinor(stateWith(emptyState))).toBe(0);
  });

  it("does not flag unavailable lines before the server has reported stock", () => {
    // availableStock is -1 until a sync; guessing "unavailable" would block
    // checkout for every optimistic add.
    const state = cartReducer(emptyState, itemAdded(product, 5));
    expect(selectHasUnavailableLines(stateWith(state))).toBe(false);
  });

  it("flags a line that exceeds known stock", () => {
    const state: CartState = {
      ...emptyState,
      lines: {
        p1: {
          productId: "p1",
          slug: product.slug,
          name: product.name,
          imageUrl: product.imageUrl,
          unitPriceMinor: product.priceMinor,
          compareAtPriceMinor: null,
          currency: "GHS",
          quantity: 5,
          availableStock: 2,
        },
      },
    };

    expect(selectHasUnavailableLines(stateWith(state))).toBe(true);
  });
});
