"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore } from "@/lib/store/store";

type StoreProviderProps = {
  children: ReactNode;
};

export function StoreProvider({ children }: StoreProviderProps) {
  // lazy init: one store per request on the server, one per tab on the client
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
