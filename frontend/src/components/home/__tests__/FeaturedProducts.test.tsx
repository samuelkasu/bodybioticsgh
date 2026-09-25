import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { connectionChanged } from "@/lib/features/network/networkSlice";
import { makeStore } from "@/lib/store/store";
import { renderWithProviders, waitFor } from "@/test/test-utils";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("FeaturedProducts", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: { items: [], page: 1, perPage: 12, total: 0 } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("asks for as many products as it reserved room for, even on a slow link", async () => {
    const store = makeStore();
    store.dispatch(connectionChanged({ quality: "slow", saveData: true }));

    renderWithProviders(<FeaturedProducts title="Latest" limit={12} />, { store });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [input] = fetchMock.mock.calls[0]!;
    const url = new URL(input instanceof Request ? input.url : String(input));
    // Fewer products than skeletons collapses rows and shifts the page (CLS).
    expect(url.searchParams.get("perPage")).toBe("12");
  });
});
