import { ProductAdmin } from "@/components/admin/ProductAdmin";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const product = (stock: number) => ({
  id: "p1",
  slug: "glow-serum",
  name: "Glow Serum",
  priceMinor: 12_500,
  salePriceMinor: null,
  saleStartsAt: null,
  saleEndsAt: null,
  onSale: false,
  currency: "GHS",
  stock,
  active: true,
  imageUrl: "/catalog/glow-serum/main.webp",
  categoryName: null,
  brandName: null,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const listOf = (stock: number) =>
  json({ data: { items: [product(stock)], page: 1, perPage: 25, total: 1 } });

describe("ProductAdmin", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  const patches: Record<string, unknown>[] = [];

  beforeEach(() => {
    fetchMock.mockReset();
    patches.length = 0;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const respond = (onPatch: () => Response) =>
    fetchMock.mockImplementation((input, init) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      if (request.method === "PATCH") {
        return request.json().then((body: Record<string, unknown>) => {
          patches.push(body);
          return onPatch();
        });
      }
      return Promise.resolve(listOf(10));
    });

  it("sends the stock it started from with a stock change", async () => {
    respond(() => json({ data: product(12) }));

    renderWithProviders(<ProductAdmin />);

    fireEvent.change(await screen.findByLabelText("Stock"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ stock: 12, expectedStock: 10 });
  });

  it("leaves stock out of a save that did not change it", async () => {
    respond(() => json({ data: product(10) }));

    renderWithProviders(<ProductAdmin />);

    fireEvent.change(await screen.findByLabelText("Price (₵)"), {
      target: { value: "99.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patches).toHaveLength(1));
    // Resending the box's number would undo any sales since the page loaded.
    expect(patches[0]).toEqual({ priceMinor: 9_900 });
  });

  it("shows the real stock when orders moved it mid-edit", async () => {
    respond(() =>
      json(
        {
          error: {
            code: "CONFLICT",
            message: "Stock changed from 10 to 7 while you were editing.",
            details: product(7),
          },
        },
        409,
      ),
    );

    renderWithProviders(<ProductAdmin />);

    const box = await screen.findByLabelText("Stock");
    fireEvent.change(box, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("from 10 to 7");
    expect(box).toHaveValue(7);
  });
});
