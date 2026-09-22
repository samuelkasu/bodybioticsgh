import { createSlice, nanoid } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/lib/store/store";

export type ToastTone = "success" | "error" | "info";

/**
 * What the chip on the left of the card shows. The tone already carries the
 * colour; the icon says which action happened, so a cart add and a wishlist
 * save are told apart at a glance instead of by reading the sentence.
 */
export type ToastIcon = "cart" | "heart" | "heart-off" | "check" | "alert" | "info";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  icon: ToastIcon;
  /** Optional in-toast link, e.g. "View cart" after an add. */
  action?: { label: string; href: string };
};

const ICON_FOR_TONE: Record<ToastTone, ToastIcon> = {
  success: "check",
  error: "alert",
  info: "info",
};

/**
 * More than this on screen at once and the newest is off the bottom of a phone,
 * which is the one the customer needs.
 */
const MAX_VISIBLE = 3;

type ToastState = { items: Toast[] };

const initialState: ToastState = { items: [] };

const toastSlice = createSlice({
  name: "toasts",
  initialState,
  reducers: {
    toastShown: {
      reducer(state, action: PayloadAction<Toast>) {
        // Tapping "add" four times fast should not stack four identical
        // cards; refresh the existing one instead.
        const duplicate = state.items.findIndex(
          (toast) =>
            toast.message === action.payload.message &&
            toast.tone === action.payload.tone,
        );
        if (duplicate !== -1) {
          state.items.splice(duplicate, 1);
        }

        state.items.push(action.payload);

        if (state.items.length > MAX_VISIBLE) {
          state.items.splice(0, state.items.length - MAX_VISIBLE);
        }
      },
      prepare(
        message: string,
        options: { tone?: ToastTone; icon?: ToastIcon; action?: Toast["action"] } = {},
      ) {
        const tone = options.tone ?? "success";
        return {
          payload: {
            id: nanoid(),
            message,
            tone,
            icon: options.icon ?? ICON_FOR_TONE[tone],
            ...(options.action ? { action: options.action } : {}),
          } satisfies Toast,
        };
      },
    },

    toastDismissed(state, action: PayloadAction<string>) {
      state.items = state.items.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { toastShown, toastDismissed } = toastSlice.actions;
export const toastReducer = toastSlice.reducer;

export const selectToasts = (state: RootState): Toast[] => state.toasts.items;
