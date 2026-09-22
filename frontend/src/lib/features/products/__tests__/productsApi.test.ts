import { productsApi } from "@/lib/features/products/productsApi";
import type { Paginated, Product, ProductDetail } from "@/lib/features/products/types";
import { makeStore } from "@/lib/store/store";
import { makeProduct } from "@/test/fixtures";

const product: Product = makeProduct();

const page: Paginated<Product> = { items: [product], page: 1, perPage: 24, total: 1 };

const detail: ProductDetail = {
  product,
  images: [{ url: "/catalog/glow-serum/main.webp", width: 1200 }],
  related: [],
};

// Route handlers answer with the { data } envelope; baseApi unwraps it.
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("productsApi", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  // fetchBaseQuery always calls fetch with a Request instance
  const requestedUrl = (callIndex = 0): string => {
    const input = fetchMock.mock.calls[callIndex]?.[0];
    return input instanceof Request ? input.url : String(input);
  };

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("fetches a product list with default pagination params", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: page }));
    const store = makeStore();

    const result = await store.dispatch(productsApi.endpoints.getProducts.initiate());

    expect(result.data).toEqual(page);
    expect(requestedUrl()).toContain("/products?page=1&perPage=24");
  });

  it("passes filters and sorting through to the API", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: page }));
    const store = makeStore();

    await store.dispatch(
      productsApi.endpoints.getProducts.initiate({
        page: 2,
        perPage: 12,
        search: "serum",
        category: "face-serum",
        brand: "anua",
        minPrice: 1_000,
        maxPrice: 50_000,
        sort: "price-asc",
      }),
    );

    const url = requestedUrl();
    expect(url).toContain("page=2");
    expect(url).toContain("perPage=12");
    expect(url).toContain("search=serum");
    expect(url).toContain("category=face-serum");
    expect(url).toContain("brand=anua");
    expect(url).toContain("minPrice=1000");
    expect(url).toContain("maxPrice=50000");
    expect(url).toContain("sort=price-asc");
  });

  it("omits filters that were not supplied", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: page }));
    const store = makeStore();

    await store.dispatch(productsApi.endpoints.getProducts.initiate({ page: 1 }));

    const url = requestedUrl();
    expect(url).not.toContain("category=");
    expect(url).not.toContain("brand=");
    expect(url).not.toContain("minPrice=");
  });

  it("keeps a zero minimum price rather than treating it as absent", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: page }));
    const store = makeStore();

    await store.dispatch(productsApi.endpoints.getProducts.initiate({ minPrice: 0 }));

    expect(requestedUrl()).toContain("minPrice=0");
  });

  it("surfaces an error result when the request fails", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "INTERNAL", message: "boom" } }, 500),
    );
    const store = makeStore();

    const result = await store.dispatch(
      productsApi.endpoints.getProductBySlug.initiate("glow-serum"),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });
});

describe("response envelope handling", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("unwraps { data } so hooks never see the envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: detail }));
    const store = makeStore();

    const result = await store.dispatch(
      productsApi.endpoints.getProductBySlug.initiate("glow-serum"),
    );

    expect(result.data).toEqual(detail);
  });

  it("passes an unenveloped body through untouched", async () => {
    // Defensive: a proxy or error page that does not follow the contract must
    // not crash the client.
    fetchMock.mockResolvedValue(jsonResponse(detail));
    const store = makeStore();

    const result = await store.dispatch(
      productsApi.endpoints.getProductBySlug.initiate("glow-serum"),
    );

    expect(result.data).toEqual(detail);
  });
});
