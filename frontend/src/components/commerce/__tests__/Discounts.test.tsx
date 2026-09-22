import { CouponForm } from "@/components/commerce/CouponForm";
import { PriceTag } from "@/components/commerce/PriceTag";
import { ProductCard } from "@/components/commerce/ProductCard";
import { selectCartCouponCode } from "@/lib/features/cart/cartSlice";
import { makeStore } from "@/lib/store/store";
import { makeProduct } from "@/test/fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/test-utils";

const onSale = makeProduct({
  priceMinor: 10_000,
  compareAtPriceMinor: 12_500,
  discountPercent: 20,
});

/** A cart response with a code applied, as the API answers. */
const discountedCart = {
  lines: [
    {
      productId: "p1",
      slug: "glow-serum",
      name: "Glow Serum",
      imageUrl: "/catalog/glow-serum/main.webp",
      unitPriceMinor: 10_000,
      compareAtPriceMinor: null,
      currency: "GHS",
      quantity: 1,
      lineTotalMinor: 10_000,
      discountMinor: 1_000,
      inStock: true,
      availableStock: 10,
    },
  ],
  itemCount: 1,
  subtotalMinor: 10_000,
  discountMinor: 1_000,
  discountedSubtotalMinor: 9_000,
  currency: "GHS",
  hasUnavailableLines: false,
  couponCode: "SAVE10",
  discounts: [
    { source: "COUPON", label: "10% off", amountMinor: 1_000, freeDelivery: false },
  ],
  freeDeliveryGranted: false,
  couponMessage: null,
};

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(status === 200 ? { data: body } : body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("PriceTag on a sale price", () => {
  it("strikes through the old price and names it for a screen reader", () => {
    renderWithProviders(<PriceTag amountMinor={10_000} compareAtMinor={12_500} />);

    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/125\.00/)).toBeInTheDocument();
    expect(screen.getByText("Was")).toBeInTheDocument();
  });

  it("shows nothing struck through when the compare price is not higher", () => {
    renderWithProviders(<PriceTag amountMinor={10_000} compareAtMinor={10_000} />);

    expect(screen.queryByText("Was")).not.toBeInTheDocument();
  });

  it("shows nothing struck through when there is no sale", () => {
    renderWithProviders(<PriceTag amountMinor={10_000} compareAtMinor={null} />);

    expect(screen.queryByText("Was")).not.toBeInTheDocument();
  });
});

describe("ProductCard on a sale", () => {
  it("badges the saving and shows both prices", () => {
    renderWithProviders(<ProductCard product={onSale} />);

    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/125\.00/)).toBeInTheDocument();
  });

  it("shows no badge on a product that is not on sale", () => {
    renderWithProviders(<ProductCard product={makeProduct()} />);

    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });
});

describe("CouponForm", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("applies a code and shows it back", async () => {
    fetchMock.mockImplementation(() => jsonResponse(discountedCart));

    const store = makeStore();
    renderWithProviders(<CouponForm />, { store });

    await userEvent.click(screen.getByRole("button", { name: /discount code/i }));
    await userEvent.type(screen.getByLabelText("Discount code"), "save10");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(selectCartCouponCode(store.getState())).toBe("SAVE10");
    });

    expect(screen.getByText("SAVE10")).toBeInTheDocument();
  });

  it("shows the server's reason when a code is refused", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse(
        { error: { code: "CONFLICT", message: "That code has expired." } },
        409,
      ),
    );

    renderWithProviders(<CouponForm />);

    await userEvent.click(screen.getByRole("button", { name: /discount code/i }));
    await userEvent.type(screen.getByLabelText("Discount code"), "OLDCODE");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code has expired.");
  });

  it("applies on Enter without submitting the checkout form around it", async () => {
    // The summary this sits in is rendered inside the checkout form. Enter
    // reaching that form would place the order.
    fetchMock.mockImplementation(() => jsonResponse(discountedCart));
    const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());

    renderWithProviders(
      <form onSubmit={onSubmit}>
        <CouponForm />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: /discount code/i }));
    await userEvent.type(screen.getByLabelText("Discount code"), "SAVE10{Enter}");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses to send an empty code", async () => {
    renderWithProviders(<CouponForm />);

    await userEvent.click(screen.getByRole("button", { name: /discount code/i }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a code.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
