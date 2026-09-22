import { baseApi } from "@/lib/api/baseApi";
import type { Currency, Paginated } from "@/lib/features/products/types";
import type { OrderStatus } from "@/lib/features/orders/ordersApi";

/** Mirrors AdminOrderDto in backend/src/BodyBiotics.Api/Features/Admin. */
export type AdminOrderLine = {
  productId: string;
  slug: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  /** This line's share of the discount, for working out a partial refund. */
  discountMinor: number;
};

export type AdminOrder = {
  reference: string;
  status: OrderStatus;
  email: string;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  /** Which delivery run this order belongs on. */
  deliveryZoneName: string;
  notes: string | null;
  subtotalMinor: number;
  /** What the offers took off the goods. Zero when none applied. */
  discountMinor: number;
  couponCode: string | null;
  discountDescription: string | null;
  /** What the rider collects on top of the goods; zero when it was free. */
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: Currency;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lines: AdminOrderLine[];
};

export type AdminOrderQuery = {
  /** Omitted or "all" for every status. */
  status?: string;
  /** Matches a reference, name, email, phone or town. */
  search?: string;
  /** Inclusive `yyyy-mm-dd` bounds on the date the order was placed. */
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
};

/**
 * Mirrors AdminProductDto. Distinct from the storefront `Product` because the
 * public endpoint exposes only `inStock` — exact stock levels would tell a
 * competitor exactly how much the shop sells.
 */
export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  /** The shelf price. Staff edit this one; a sale is the three fields below. */
  priceMinor: number;
  salePriceMinor: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  /** Whether the sale is running at this moment. */
  onSale: boolean;
  currency: Currency;
  stock: number;
  active: boolean;
  imageUrl: string;
  categoryName: string | null;
  brandName: string | null;
};

export type AdminProductQuery = {
  search?: string;
  page?: number;
  perPage?: number;
};

export type ProductPatch = {
  productId: string;
  priceMinor?: number;
  stock?: number;
  active?: boolean;
  salePriceMinor?: number;
  saleStartsAt?: string;
  saleEndsAt?: string;
  /**
   * Ends the sale and forgets its dates. A flag rather than a null, because an
   * absent field and a null one reach the API identically and "leave the sale
   * alone" must not read as "delete it".
   */
  clearSale?: boolean;
};

/**
 * Staff-only endpoints. Every one of them is behind the API's admin policy, so
 * this module cannot leak anything to a customer who loads the bundle — the
 * worst they get is a 403.
 */
export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminOrders: build.query<Paginated<AdminOrder>, AdminOrderQuery>({
      query: ({ status, search, from, to, page = 1, perPage = 25 }) => ({
        url: "/admin/orders",
        params: {
          ...(status && status !== "all" ? { status } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          page,
          perPage,
        },
      }),
      providesTags: ["Order"],
    }),

    adminOrder: build.query<AdminOrder, string>({
      query: (reference) => ({ url: `/admin/orders/${encodeURIComponent(reference)}` }),
      providesTags: (result) =>
        result ? [{ type: "Order" as const, id: result.reference }] : [],
    }),

    adminUpdateOrderStatus: build.mutation<
      AdminOrder,
      { reference: string; status: string }
    >({
      query: ({ reference, status }) => ({
        url: `/admin/orders/${encodeURIComponent(reference)}/status`,
        method: "POST",
        body: { status },
      }),
      // Not optimistic: a status change can be refused by the state machine,
      // and cancelling also moves stock. Showing the server's answer is the
      // honest thing here — unlike the wishlist, nobody is tapping this on a
      // 3G connection twenty times a minute.
      invalidatesTags: ["Order", "Product"],
    }),

    adminProducts: build.query<Paginated<AdminProduct>, AdminProductQuery>({
      query: ({ search, page = 1, perPage = 25 }) => ({
        url: "/admin/products",
        params: { ...(search ? { search } : {}), page, perPage },
      }),
      providesTags: ["Product"],
    }),

    adminUpdateProduct: build.mutation<AdminProduct, ProductPatch>({
      query: ({ productId, ...patch }) => ({
        url: `/admin/products/${encodeURIComponent(productId)}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: ["Product"],
    }),
  }),
});

export const {
  useAdminOrdersQuery,
  useAdminOrderQuery,
  useAdminUpdateOrderStatusMutation,
  useAdminProductsQuery,
  useAdminUpdateProductMutation,
} = adminApi;
