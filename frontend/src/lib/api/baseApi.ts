import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

import type { ApiError, ApiSuccess } from "@/lib/api/http";
import { clientEnv } from "@/lib/env";

export const TAG_TYPES = [
  "Product",
  "Cart",
  "Order",
  "Session",
  "Review",
  "Wishlist",
  "Promotion",
  "Coupon",
] as const;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: clientEnv.NEXT_PUBLIC_API_URL,
  credentials: "include",
  // resolve fetch per call instead of at module load, so tests can swap it
  fetchFn: (...args) => globalThis.fetch(...args),
  prepareHeaders: (headers) => {
    headers.set("Accept", "application/json");
    return headers;
  },
});

/**
 * Every route handler answers with `{ data }` or `{ error }` (see lib/api/http).
 * Unwrapping once here keeps that envelope out of every component and hook.
 */
const envelopeBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) return result;

  const body = result.data as Partial<ApiSuccess<unknown>> & Partial<ApiError>;
  if (body && typeof body === "object" && "data" in body) {
    return { ...result, data: body.data };
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: envelopeBaseQuery,
  tagTypes: TAG_TYPES,
  // A storefront on mobile data should not refetch the catalogue on every tab
  // focus; RTK Query still revalidates on mount after the cache time expires.
  keepUnusedDataFor: 120,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
