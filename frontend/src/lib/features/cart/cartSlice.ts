import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { cartApi, type CartDiscount, type ServerCart } from "@/lib/features/cart/cartApi";
import type { Currency, Product } from "@/lib/features/products/types";
import type { RootState } from "@/lib/store/store";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string;
  unitPriceMinor: number;
  /** The struck-through "was" price, or null when not on sale. */
  compareAtPriceMinor: number | null;
  currency: Currency;
  quantity: number;
  /** Stock known at sync time; -1 means "not yet known from the server". */
  availableStock: number;
};

/**
 * What the offers are worth on this basket. Mirrored from the server rather
 * than worked out here: the client is shown the figure, never trusted with it,
 * and duplicating the engine in TypeScript is how the two drift apart.
 */
export type CartPricing = {
  discountMinor: number;
  couponCode: string | null;
  discounts: CartDiscount[];
  freeDeliveryGranted: boolean;
  /** Why an applied code stopped applying. Null when there is nothing to say. */
  couponMessage: string | null;
};

export type CartState = {
  lines: Record<string, CartLine>;
  pricing: CartPricing;
  isOpen: boolean;
  /** True between an optimistic change and the server confirming it. */
  isSyncing: boolean;
};

export const MAX_QUANTITY_PER_LINE = 99;

const noPricing: CartPricing = {
  discountMinor: 0,
  couponCode: null,
  discounts: [],
  freeDeliveryGranted: false,
  couponMessage: null,
};

const initialState: CartState = {
  lines: {},
  pricing: noPricing,
  isOpen: false,
  isSyncing: false,
};

const clampQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY_PER_LINE);
};

const fromServer = (cart: ServerCart): Record<string, CartLine> =>
  Object.fromEntries(
    (cart.lines ?? []).map((line) => [
      line.productId,
      {
        productId: line.productId,
        slug: line.slug,
        name: line.name,
        imageUrl: line.imageUrl,
        unitPriceMinor: line.unitPriceMinor,
        compareAtPriceMinor: line.compareAtPriceMinor ?? null,
        currency: line.currency,
        quantity: line.quantity,
        availableStock: line.availableStock,
      } satisfies CartLine,
    ]),
  );

/**
 * Every field defaulted rather than taken on trust. The type says they are all
 * there, and from the current API they are — but a response can also come from
 * a service worker's cache, a proxy, or an API that has not been redeployed
 * yet, and none of those are worth taking the cart page down over. Losing a
 * discount line is recoverable; a blank page is a lost order.
 */
const pricingFromServer = (cart: ServerCart): CartPricing => ({
  discountMinor: cart.discountMinor ?? 0,
  couponCode: cart.couponCode ?? null,
  discounts: cart.discounts ?? [],
  freeDeliveryGranted: cart.freeDeliveryGranted ?? false,
  couponMessage: cart.couponMessage ?? null,
});

/**
 * The client mirror of the server cart. It exists so the header count and the
 * cart drawer update on tap rather than after a round-trip — on a Ghanaian 3G
 * connection that is the difference between "instant" and "broken".
 * Every server response overwrites it; the server is always right.
 */
const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    itemAdded: {
      reducer(state, action: PayloadAction<{ product: Product; quantity: number }>) {
        const { product, quantity } = action.payload;
        const existing = state.lines[product.id];
        const nextQuantity = clampQuantity((existing?.quantity ?? 0) + quantity);

        if (nextQuantity === 0) {
          delete state.lines[product.id];
          return;
        }

        state.lines[product.id] = {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          imageUrl: product.imageUrl,
          unitPriceMinor: product.priceMinor,
          compareAtPriceMinor: product.compareAtPriceMinor,
          currency: product.currency,
          quantity: nextQuantity,
          availableStock: existing?.availableStock ?? -1,
        };
      },
      prepare(product: Product, quantity = 1) {
        return { payload: { product, quantity } };
      },
    },

    quantitySet(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const { productId, quantity } = action.payload;
      const line = state.lines[productId];
      if (!line) return;

      const nextQuantity = clampQuantity(quantity);
      if (nextQuantity === 0) {
        delete state.lines[productId];
        return;
      }
      line.quantity = nextQuantity;
    },

    itemRemoved(state, action: PayloadAction<string>) {
      delete state.lines[action.payload];
    },

    cartCleared(state) {
      state.lines = {};
      // The code goes with the basket, as it does on the server.
      state.pricing = noPricing;
    },

    cartToggled(state, action: PayloadAction<boolean | undefined>) {
      state.isOpen = action.payload ?? !state.isOpen;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(cartApi.endpoints.getCart.matchFulfilled, (state, action) => {
        state.lines = fromServer(action.payload);
        state.pricing = pricingFromServer(action.payload);
        state.isSyncing = false;
      })
      .addMatcher(cartApi.endpoints.addToCart.matchFulfilled, (state, action) => {
        state.lines = fromServer(action.payload);
        state.pricing = pricingFromServer(action.payload);
        state.isSyncing = false;
      })
      .addMatcher(cartApi.endpoints.updateCartLine.matchFulfilled, (state, action) => {
        state.lines = fromServer(action.payload);
        state.pricing = pricingFromServer(action.payload);
        state.isSyncing = false;
      })
      .addMatcher(cartApi.endpoints.applyCoupon.matchFulfilled, (state, action) => {
        state.lines = fromServer(action.payload);
        state.pricing = pricingFromServer(action.payload);
      })
      .addMatcher(cartApi.endpoints.removeCoupon.matchFulfilled, (state, action) => {
        state.lines = fromServer(action.payload);
        state.pricing = pricingFromServer(action.payload);
      })
      .addMatcher(cartApi.endpoints.clearCart.matchFulfilled, (state) => {
        state.lines = {};
        state.pricing = noPricing;
        state.isSyncing = false;
      })
      .addMatcher(cartApi.endpoints.addToCart.matchPending, (state) => {
        state.isSyncing = true;
      })
      .addMatcher(cartApi.endpoints.updateCartLine.matchPending, (state) => {
        state.isSyncing = true;
      })
      // A failed mutation leaves the optimistic value on screen, so drop the
      // syncing flag and let the next getCart reconcile.
      .addMatcher(cartApi.endpoints.addToCart.matchRejected, (state) => {
        state.isSyncing = false;
      })
      .addMatcher(cartApi.endpoints.updateCartLine.matchRejected, (state) => {
        state.isSyncing = false;
      });
  },
});

export const { itemAdded, quantitySet, itemRemoved, cartCleared, cartToggled } =
  cartSlice.actions;

export const cartReducer = cartSlice.reducer;

export const selectCart = (state: RootState): CartState => state.cart;

export const selectCartLines = createSelector([selectCart], (cart) =>
  Object.values(cart.lines).sort((a, b) => a.name.localeCompare(b.name)),
);

export const selectCartItemCount = createSelector([selectCartLines], (lines) =>
  lines.reduce((total, line) => total + line.quantity, 0),
);

export const selectCartSubtotalMinor = createSelector([selectCartLines], (lines) =>
  lines.reduce((total, line) => total + line.unitPriceMinor * line.quantity, 0),
);

export const selectIsCartOpen = createSelector([selectCart], (cart) => cart.isOpen);

export const selectIsCartSyncing = createSelector([selectCart], (cart) => cart.isSyncing);

/** Blocks checkout: a line is asking for more than the shop has left. */
export const selectHasUnavailableLines = createSelector([selectCartLines], (lines) =>
  lines.some((line) => line.availableStock >= 0 && line.quantity > line.availableStock),
);

/** What the offers take off the goods, as the server worked it out. */
export const selectCartPricing = createSelector([selectCart], (cart) => cart.pricing);

export const selectCartDiscountMinor = createSelector(
  [selectCartPricing],
  (pricing) => pricing.discountMinor,
);

export const selectCartDiscounts = createSelector(
  [selectCartPricing],
  (pricing) => pricing.discounts,
);

export const selectCartCouponCode = createSelector(
  [selectCartPricing],
  (pricing) => pricing.couponCode,
);

export const selectCartFreeDeliveryGranted = createSelector(
  [selectCartPricing],
  (pricing) => pricing.freeDeliveryGranted,
);

/**
 * Goods after discount — the figure delivery is priced against and the one a
 * total is built from. Floored at zero: a discount larger than the basket
 * cannot make the shop owe the customer money.
 */
export const selectCartDiscountedSubtotalMinor = createSelector(
  [selectCartSubtotalMinor, selectCartDiscountMinor],
  (subtotal, discount) => Math.max(0, subtotal - discount),
);

export const selectCartCurrency = createSelector(
  [selectCartLines],
  (lines): Currency => lines[0]?.currency ?? "GHS",
);
