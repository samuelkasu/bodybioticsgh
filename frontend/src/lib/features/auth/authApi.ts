import { baseApi } from "@/lib/api/baseApi";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "ADMIN";
};

export type Credentials = { email: string; password: string };
export type Registration = Credentials & { name?: string };

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSession: build.query<{ user: SessionUser | null }, void>({
      query: () => ({ url: "/auth/session" }),
      providesTags: ["Session"],
    }),

    login: build.mutation<SessionUser, Credentials>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      // Cart, wishlist and orders are per-user, and the API merges the
      // anonymous cart and wishlist onto the account during sign-in — so the
      // client's anonymous copies are stale the moment this returns.
      invalidatesTags: ["Session", "Cart", "Order", "Wishlist"],
    }),

    register: build.mutation<SessionUser, Registration>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      invalidatesTags: ["Session", "Cart", "Order", "Wishlist"],
    }),

    // Answers the same whether or not the address has an account — the API
    // will not say, so neither can the UI.
    forgotPassword: build.mutation<{ sent: boolean }, { email: string }>({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
    }),

    // The API signs the customer in on success, so this invalidates everything
    // per-user exactly as login does.
    resetPassword: build.mutation<SessionUser, { token: string; password: string }>({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
      invalidatesTags: ["Session", "Cart", "Order", "Wishlist"],
    }),

    logout: build.mutation<{ signedOut: boolean }, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      invalidatesTags: ["Session", "Cart", "Order", "Wishlist"],
    }),
  }),
});

export const {
  useGetSessionQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
