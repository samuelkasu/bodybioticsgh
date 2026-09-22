import { baseApi } from "@/lib/api/baseApi";
import type { Currency } from "@/lib/features/products/types";

/** Mirrors CartDto in backend/src/BodyBiotics.Api/Features/Cart. */
export type ServerCartLine = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string;
  /** Today's price: the sale price while a sale is running. */
  unitPriceMinor: number;
  /** The struck-through "was" price, or null. */
  compareAtPriceMinor: number | null;
  currency: Currency;
  quantity: number;
  lineTotalMinor: number;
  /** This line's share of the basket discount. */
  discountMinor: number;
  inStock: boolean;
  availableStock: number;
};

/** One offer applying to the basket right now. */
export type CartDiscount = {
  source: "PROMOTION" | "COUPON";
  label: string;
  amountMinor: number;
  freeDelivery: boolean;
};

export type ServerCart = {
  lines: ServerCartLine[];
  itemCount: number;
  /** Goods before any discount. */
  subtotalMinor: number;
  discountMinor: number;
  /** Goods after discount — what delivery is priced against. */
  discountedSubtotalMinor: number;
  currency: Currency;
  /** A line now exceeds available stock; checkout is blocked until it is fixed. */
  hasUnavailableLines: boolean;
  /** The code currently applied, or null. */
  couponCode: string | null;
  discounts: CartDiscount[];
  /** An offer waived delivery outright, whatever the basket comes to. */
  freeDeliveryGranted: boolean;
  /**
   * Why a code that was applied has stopped applying. The server drops the
   * code and says so here rather than leaving it to surprise the customer at
   * checkout.
   */
  couponMessage: string | null;
};

export const cartApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCart: build.query<ServerCart, void>({
      query: () => ({ url: "/cart" }),
      providesTags: ["Cart"],
    }),

    addToCart: build.mutation<ServerCart, { productId: string; quantity?: number }>({
      query: (body) => ({ url: "/cart/items", method: "POST", body }),
      // The mutation returns the whole cart, so patch the cache directly
      // instead of refetching — one round-trip saved on every add.
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.upsertQueryData("getCart", undefined, data));
        } catch {
          // An unhandled queryFulfilled rejection surfaces as an unhandled
          // promise rejection; the caller already reports the failure.
        }
      },
    }),

    updateCartLine: build.mutation<ServerCart, { productId: string; quantity: number }>({
      query: (body) => ({ url: "/cart/items", method: "PATCH", body }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.upsertQueryData("getCart", undefined, data));
        } catch {
          // An unhandled queryFulfilled rejection surfaces as an unhandled
          // promise rejection; the caller already reports the failure.
        }
      },
    }),

    clearCart: build.mutation<ServerCart, void>({
      query: () => ({ url: "/cart", method: "DELETE" }),
      invalidatesTags: ["Cart"],
    }),

    // Not optimistic, unlike the quantity mutations: whether a code applies is
    // the server's to say, and showing a discount that is about to be taken
    // away is worse than a moment's wait.
    applyCoupon: build.mutation<ServerCart, string>({
      query: (code) => ({ url: "/cart/coupon", method: "POST", body: { code } }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.upsertQueryData("getCart", undefined, data));
        } catch {
          // The caller renders the refusal; swallowing it here only stops an
          // unhandled rejection.
        }
      },
    }),

    removeCoupon: build.mutation<ServerCart, void>({
      query: () => ({ url: "/cart/coupon", method: "DELETE" }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(cartApi.util.upsertQueryData("getCart", undefined, data));
        } catch {
          // As above.
        }
      },
    }),
  }),
});

export const {
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartLineMutation,
  useClearCartMutation,
  useApplyCouponMutation,
  useRemoveCouponMutation,
} = cartApi;
