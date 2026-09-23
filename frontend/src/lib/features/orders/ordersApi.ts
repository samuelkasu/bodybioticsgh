import { baseApi } from "@/lib/api/baseApi";
import type { Currency } from "@/lib/features/products/types";

/** DISPATCHED is out for delivery; FULFILLED is delivered. */
export type OrderStatus =
  "PENDING" | "PAID" | "DISPATCHED" | "FULFILLED" | "CANCELLED" | "REFUNDED";

export type OrderLine = {
  productId: string;
  slug: string;
  name: string;
  /** What was charged per unit — the sale price when there was one. */
  unitPriceMinor: number;
  /** The shelf price at the time, when the item was on sale. Null otherwise. */
  listPriceMinor: number | null;
  quantity: number;
  lineTotalMinor: number;
  /** This line's share of the order's discount. */
  discountMinor: number;
};

export type PaymentMethod = "ON_DELIVERY" | "HUBTEL";

export type PaymentMethods = {
  onDelivery: boolean;
  /** False when Hubtel has no credentials configured, so the option is hidden. */
  hubtel: boolean;
};

/** One delivery area and its fee. Mirrors DeliveryZoneDto on the API. */
export type DeliveryZone = {
  code: string;
  name: string;
  feeMinor: number;
  /** Customer-facing wording, e.g. "1–2 working days". */
  estimate: string;
};

export type DeliveryOptions = {
  zones: DeliveryZone[];
  freeDeliveryThresholdMinor: number;
  currency: Currency;
};

export type Order = {
  reference: string;
  status: OrderStatus;
  email: string;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  deliveryZone: string;
  deliveryZoneName: string;
  notes: string | null;
  paymentMethod: PaymentMethod;
  /** Where to go to pay. Present only while an online order is unpaid. */
  checkoutUrl: string | null;
  isPaid: boolean;
  /** Goods before any discount. */
  subtotalMinor: number;
  /** What the offers took off. Zero on an order that had none. */
  discountMinor: number;
  couponCode: string | null;
  /** What the discount was called, as it read on the day. */
  discountDescription: string | null;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: Currency;
  createdAt: string;
  lines: OrderLine[];
};

export type CheckoutPayload = {
  email: string;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  notes?: string;
  /**
   * Idempotency key. Generated once per checkout attempt and reused on retry,
   * so a dropped connection cannot produce two orders.
   */
  requestId: string;
  paymentMethod: PaymentMethod;
  /**
   * Which area to deliver to. Only the code travels — the fee is looked up on
   * the server, so a tampered client cannot buy itself cheaper delivery.
   */
  deliveryZone: string;
};

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    placeOrder: build.mutation<Order, CheckoutPayload>({
      query: (body) => ({ url: "/checkout", method: "POST", body }),
      // Checkout empties the cart and creates an order.
      invalidatesTags: ["Cart", "Order"],
    }),

    getOrder: build.query<Order, string>({
      query: (reference) => ({ url: `/orders/${reference}` }),
      providesTags: (result) =>
        result ? [{ type: "Order" as const, id: result.reference }] : [],
    }),

    paymentMethods: build.query<PaymentMethods, void>({
      query: () => ({ url: "/payments/methods" }),
    }),

    deliveryOptions: build.query<DeliveryOptions, void>({
      query: () => ({ url: "/delivery-options" }),
      // A price list, not a user's data: worth keeping for the whole session so
      // the checkout total is on screen immediately on a second visit.
      keepUnusedDataFor: 3_600,
    }),

    getOrders: build.query<Order[], void>({
      query: () => ({ url: "/orders" }),
      providesTags: ["Order"],
    }),
  }),
});

export const {
  usePlaceOrderMutation,
  useGetOrderQuery,
  useGetOrdersQuery,
  usePaymentMethodsQuery,
  useDeliveryOptionsQuery,
} = ordersApi;
