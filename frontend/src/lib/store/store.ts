import { configureStore } from "@reduxjs/toolkit";
import type { Action, ThunkAction } from "@reduxjs/toolkit";

import { baseApi } from "@/lib/api/baseApi";
import { cartReducer } from "@/lib/features/cart/cartSlice";
import { consentReducer } from "@/lib/features/consent/consentSlice";
import { networkReducer } from "@/lib/features/network/networkSlice";
import { toastReducer } from "@/lib/features/ui/toastSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      cart: cartReducer,
      consent: consentReducer,
      network: networkReducer,
      toasts: toastReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action
>;
