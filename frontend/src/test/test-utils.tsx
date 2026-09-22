import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore, type AppStore } from "@/lib/store/store";

type ExtendedRenderOptions = Omit<RenderOptions, "wrapper"> & {
  store?: AppStore;
};

type RenderWithProvidersResult = RenderResult & {
  store: AppStore;
};

export function renderWithProviders(
  ui: ReactElement,
  { store = makeStore(), ...renderOptions }: ExtendedRenderOptions = {},
): RenderWithProvidersResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
