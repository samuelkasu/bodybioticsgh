import { baseApi } from "@/lib/api/baseApi";
import type { Currency, Paginated } from "@/lib/features/products/types";

/** How a discount is worked out. Mirrors DiscountType on the API. */
export type DiscountType = "PERCENTAGE" | "FIXEDAMOUNT" | "FREEDELIVERY" | "BUYXGETY";

/** What a campaign is allowed to touch. Mirrors PromotionScope. */
export type PromotionScope = "EVERYTHING" | "CATEGORY" | "BRAND" | "PRODUCT";

export const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: "PERCENTAGE", label: "Percent off" },
  { value: "FIXEDAMOUNT", label: "Amount off" },
  { value: "FREEDELIVERY", label: "Free delivery" },
  { value: "BUYXGETY", label: "Buy X get Y free" },
];

export const PROMOTION_SCOPES: { value: PromotionScope; label: string }[] = [
  { value: "EVERYTHING", label: "Everything" },
  { value: "CATEGORY", label: "Chosen categories" },
  { value: "BRAND", label: "Chosen brands" },
  { value: "PRODUCT", label: "Chosen products" },
];

/** What the storefront is told about a running campaign. Never the codes. */
export type PublicPromotion = {
  description: string;
  discountType: DiscountType;
  value: number;
  minSpendMinor: number;
  endsAt: string | null;
  bannerText: string | null;
};

export type StorefrontPromotions = {
  promotions: PublicPromotion[];
  /** Lines for the announcement strip, in priority order. */
  banners: string[];
  freeDeliveryThresholdMinor: number;
  currency: Currency;
};

export type AdminCoupon = {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  scope: PromotionScope;
  scopeSlugs: string | null;
  value: number;
  maxDiscountMinor: number | null;
  minSpendMinor: number;
  minQuantity: number;
  buyQuantity: number;
  getQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  timesUsed: number;
  active: boolean;
  /** Whether it would be accepted right now, before looking at a basket. */
  isLive: boolean;
  createdAt: string;
};

export type AdminPromotion = {
  id: string;
  name: string;
  description: string;
  discountType: DiscountType;
  scope: PromotionScope;
  scopeSlugs: string | null;
  value: number;
  maxDiscountMinor: number | null;
  minSpendMinor: number;
  minQuantity: number;
  buyQuantity: number;
  getQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  priority: number;
  stackable: boolean;
  bannerText: string | null;
  isLive: boolean;
  createdAt: string;
};

export type SaveCouponBody = Omit<
  AdminCoupon,
  "id" | "timesUsed" | "isLive" | "createdAt"
>;

export type SavePromotionBody = Omit<AdminPromotion, "id" | "isLive" | "createdAt">;

export const promotionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Public: the header reads this to know what to announce.
    storefrontPromotions: build.query<StorefrontPromotions, void>({
      query: () => ({ url: "/promotions" }),
      providesTags: ["Promotion"],
      // A campaign list changes on the day a campaign starts, not on the
      // minute. Keeping it for the session spares a mobile connection a
      // request on every page.
      keepUnusedDataFor: 3_600,
    }),

    adminPromotions: build.query<AdminPromotion[], void>({
      query: () => ({ url: "/admin/promotions" }),
      providesTags: ["Promotion"],
    }),

    adminCreatePromotion: build.mutation<AdminPromotion, SavePromotionBody>({
      query: (body) => ({ url: "/admin/promotions", method: "POST", body }),
      invalidatesTags: ["Promotion", "Cart"],
    }),

    adminUpdatePromotion: build.mutation<
      AdminPromotion,
      { id: string } & SavePromotionBody
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/promotions/${encodeURIComponent(id)}`,
        method: "PUT",
        body,
      }),
      // Cart too: a campaign edited while someone is shopping changes what
      // their basket costs.
      invalidatesTags: ["Promotion", "Cart"],
    }),

    adminDeletePromotion: build.mutation<{ deleted: boolean }, string>({
      query: (id) => ({
        url: `/admin/promotions/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Promotion", "Cart"],
    }),

    adminCoupons: build.query<
      Paginated<AdminCoupon>,
      { search?: string; page?: number; perPage?: number }
    >({
      query: ({ search, page = 1, perPage = 25 }) => ({
        url: "/admin/coupons",
        params: { ...(search ? { search } : {}), page, perPage },
      }),
      providesTags: ["Coupon"],
    }),

    adminCreateCoupon: build.mutation<AdminCoupon, SaveCouponBody>({
      query: (body) => ({ url: "/admin/coupons", method: "POST", body }),
      invalidatesTags: ["Coupon"],
    }),

    adminUpdateCoupon: build.mutation<AdminCoupon, { id: string } & SaveCouponBody>({
      query: ({ id, ...body }) => ({
        url: `/admin/coupons/${encodeURIComponent(id)}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Coupon"],
    }),

    // A code that has been used comes back deactivated rather than deleted:
    // its redemptions point at real orders.
    adminDeleteCoupon: build.mutation<
      { deleted: boolean; coupon: AdminCoupon | null },
      string
    >({
      query: (id) => ({
        url: `/admin/coupons/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Coupon"],
    }),
  }),
});

export const {
  useStorefrontPromotionsQuery,
  useAdminPromotionsQuery,
  useAdminCreatePromotionMutation,
  useAdminUpdatePromotionMutation,
  useAdminDeletePromotionMutation,
  useAdminCouponsQuery,
  useAdminCreateCouponMutation,
  useAdminUpdateCouponMutation,
  useAdminDeleteCouponMutation,
} = promotionsApi;
