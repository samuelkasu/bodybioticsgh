import { WishlistButton } from "@/components/commerce/WishlistButton";
import { makeProduct } from "@/test/fixtures";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const product = makeProduct();

const wishlistWith = (items: unknown[]) => ({
  data: { items, count: items.length },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("WishlistButton", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("offers to save a product that is not saved yet", async () => {
    fetchMock.mockResolvedValue(json(wishlistWith([])));

    renderWithProviders(<WishlistButton product={product} />);

    const button = await screen.findByRole("button", {
      name: /save .*to your wishlist/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a product already saved as saved", async () => {
    fetchMock.mockResolvedValue(json(wishlistWith([product])));

    renderWithProviders(<WishlistButton product={product} />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /remove .*from your wishlist/i }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("fills the heart before the request lands", async () => {
    // GET first, then the POST — the save resolves only when we let it.
    fetchMock.mockResolvedValueOnce(json(wishlistWith([])));
    let resolveSave: (value: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveSave = resolve;
      }),
    );
    // The save invalidates the Wishlist tag, so a refetch follows; without a
    // default the mock hands back undefined and fetchBaseQuery throws.
    fetchMock.mockResolvedValue(json(wishlistWith([product])));

    renderWithProviders(<WishlistButton product={product} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /save .*to your wishlist/i }),
    );

    // On a 3G connection the round-trip is long enough that a heart which only
    // fills on success reads as a dead control.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /remove .*from your wishlist/i }),
      ).toBeInTheDocument(),
    );

    resolveSave(json(wishlistWith([product])));
  });

  it("rolls back when the save fails", async () => {
    fetchMock.mockResolvedValueOnce(json(wishlistWith([])));
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "INTERNAL", message: "boom" } }, 500),
    );
    fetchMock.mockResolvedValue(json(wishlistWith([])));

    renderWithProviders(<WishlistButton product={product} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /save .*to your wishlist/i }),
    );

    // A filled heart on a save that never landed is the one outcome to avoid:
    // the customer believes the item is kept and it is not.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /save .*to your wishlist/i }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
  });
});
