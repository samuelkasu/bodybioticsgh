import { baseApi } from "@/lib/api/baseApi";
import type { Product } from "@/lib/features/products/types";

/** Mirrors WishlistDto in backend/src/BodyBiotics.Api/Features/Wishlist. */
export type Wishlist = {
  items: Product[];
  count: number;
};

const EMPTY: Wishlist = { items: [], count: 0 };

export const wishlistApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWishlist: build.query<Wishlist, void>({
      query: () => ({ url: "/wishlist" }),
      providesTags: ["Wishlist"],
    }),

    saveToWishlist: build.mutation<Wishlist, { product: Product }>({
      query: ({ product }) => ({
        url: "/wishlist/items",
        method: "POST",
        body: { productId: product.id },
      }),

      // The heart has to fill the instant it is tapped — on a 3G connection the
      // round-trip is long enough that anything else reads as a dead control.
      // The whole wishlist comes back on success, so the optimistic patch is
      // replaced rather than merged.
      onQueryStarted: async ({ product }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          wishlistApi.util.updateQueryData("getWishlist", undefined, (draft) => {
            if (draft.items.some((saved) => saved.id === product.id)) return;
            draft.items.unshift(product);
            draft.count = draft.items.length;
          }),
        );

        try {
          const { data } = await queryFulfilled;
          dispatch(wishlistApi.util.upsertQueryData("getWishlist", undefined, data));
        } catch {
          // Roll back to what the server last told us. The caller surfaces the
          // failure; leaving a filled heart on a save that never landed is the
          // one outcome worth avoiding.
          patch.undo();
        }
      },
    }),

    removeFromWishlist: build.mutation<Wishlist, { productId: string }>({
      query: ({ productId }) => ({
        url: `/wishlist/items/${encodeURIComponent(productId)}`,
        method: "DELETE",
      }),

      onQueryStarted: async ({ productId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          wishlistApi.util.updateQueryData("getWishlist", undefined, (draft) => {
            draft.items = draft.items.filter((saved) => saved.id !== productId);
            draft.count = draft.items.length;
          }),
        );

        try {
          const { data } = await queryFulfilled;
          dispatch(wishlistApi.util.upsertQueryData("getWishlist", undefined, data));
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetWishlistQuery,
  useSaveToWishlistMutation,
  useRemoveFromWishlistMutation,
} = wishlistApi;

export { EMPTY as EMPTY_WISHLIST };
