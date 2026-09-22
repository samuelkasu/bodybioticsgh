import { ProductCard } from "@/components/commerce/ProductCard";
import { selectCartItemCount } from "@/lib/features/cart/cartSlice";
import { makeStore } from "@/lib/store/store";
import { makeProduct } from "@/test/fixtures";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const cartResponse = {
  lines: [
    {
      productId: "p1",
      slug: "glow-serum",
      name: "Glow Serum",
      imageUrl: "/catalog/glow-serum/main.webp",
      unitPriceMinor: 12_500,
      currency: "GHS",
      quantity: 1,
      lineTotalMinor: 12_500,
      inStock: true,
      availableStock: 10,
    },
  ],
  itemCount: 1,
  subtotalMinor: 12_500,
  currency: "GHS",
  hasUnavailableLines: false,
};

describe("ProductCard", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("shows the name and the price in cedis", () => {
    renderWithProviders(<ProductCard product={makeProduct()} />);

    expect(screen.getByText("Glow Serum")).toBeInTheDocument();
    expect(screen.getByText(/125\.00/)).toBeInTheDocument();
  });

  it("links to the product page", () => {
    renderWithProviders(<ProductCard product={makeProduct()} />);

    const link = screen.getByRole("link", { name: "Glow Serum" });
    expect(link).toHaveAttribute("href", "/product/glow-serum");
  });

  it("renders a brandless product without a gap", () => {
    // 27 imported products genuinely have no brand. The card matches the
    // original storefront's: name and price only, no brand line at all.
    renderWithProviders(
      <ProductCard product={makeProduct({ brandName: null, brandSlug: null })} />,
    );

    expect(screen.getByText("Glow Serum")).toBeInTheDocument();
    expect(screen.queryByText("Anua")).not.toBeInTheDocument();
  });

  it("sends a sold-out product to its page instead of offering the cart", () => {
    // The original storefront swaps "Add to cart" for "Read more" here rather
    // than showing a dead button.
    renderWithProviders(<ProductCard product={makeProduct({ inStock: false })} />);

    expect(screen.getByRole("link", { name: /read more about/i })).toHaveAttribute(
      "href",
      "/product/glow-serum",
    );
    expect(
      screen.queryByRole("button", { name: /add to cart/i }),
    ).not.toBeInTheDocument();
  });

  it("adds to the cart optimistically and keeps the line when the server agrees", async () => {
    // A fresh Response per call: a body can only be read once, and the card
    // also fetches the wishlist, so a single shared instance leaves the cart
    // request parsing an already-consumed body.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: cartResponse }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const store = makeStore();
    renderWithProviders(<ProductCard product={makeProduct()} />, { store });

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    // Optimistic: the count moves before the request resolves.
    expect(selectCartItemCount(store.getState())).toBe(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(selectCartItemCount(store.getState())).toBe(1));
  });

  it("rolls the optimistic line back when the request fails", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: "INTERNAL", message: "boom" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const store = makeStore();
    renderWithProviders(<ProductCard product={makeProduct()} />, { store });

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    // A phantom item in the cart is worse than an error message.
    await waitFor(() => expect(selectCartItemCount(store.getState())).toBe(0));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not add/i);
  });
});
