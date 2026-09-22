import { OrderDetail } from "@/components/admin/OrderDetail";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const order = (status: string) => ({
  reference: "BB-20260917-K7QX4M9T",
  status,
  email: "ama@example.com",
  fullName: "Ama Mensah",
  phone: "024 123 4567",
  addressLine: "12 Oxford Street",
  city: "Accra",
  deliveryZoneName: "Accra Central, Osu, Labone",
  notes: "Blue gate opposite the pharmacy",
  subtotalMinor: 23_000,
  deliveryFeeMinor: 2_000,
  totalMinor: 25_000,
  currency: "GHS",
  itemCount: 2,
  createdAt: "2026-09-17T09:00:00Z",
  updatedAt: "2026-09-17T09:00:00Z",
  lines: [
    {
      productId: "p1",
      slug: "glow-serum",
      name: "Glow Serum",
      unitPriceMinor: 12_500,
      quantity: 2,
      lineTotalMinor: 25_000,
    },
  ],
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("OrderDetail", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("shows what staff need to deliver the order", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ data: order("PENDING") })));

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("12 Oxford Street, Accra")).toBeInTheDocument();
    expect(screen.getByText("Blue gate opposite the pharmacy")).toBeInTheDocument();
    // Tappable, because confirming by phone is the first thing that happens.
    expect(screen.getByRole("link", { name: "024 123 4567" })).toHaveAttribute(
      "href",
      "tel:0241234567",
    );
  });

  it("offers only the transitions the state machine allows", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ data: order("PENDING") })));

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    expect(await screen.findByRole("button", { name: "Mark paid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
    // A pending order cannot be delivered before it is paid.
    expect(
      screen.queryByRole("button", { name: "Mark delivered" }),
    ).not.toBeInTheDocument();
  });

  it("says when an order is finished rather than offering dead buttons", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ data: order("CANCELLED") })),
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    expect(await screen.findByText(/is finished/i)).toBeInTheDocument();
  });

  it("surfaces a refused transition instead of pretending it worked", async () => {
    // Routed by method rather than call order: the query refetches after the
    // mutation invalidates its tag, so a queue of one-shot mocks runs dry and
    // the failure looks like a load error instead of a refused transition.
    // The method is read off the Request itself: fetchBaseQuery builds one and
    // calls fetch(request), so `init` is undefined and routing on it would send
    // every call down the success path.
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        (input instanceof Request ? input.method : (init?.method ?? "GET")) === "POST"
          ? json(
              {
                error: {
                  code: "CONFLICT",
                  message: "An order that is PAID cannot become PAID.",
                },
              },
              409,
            )
          : json({ data: order("PENDING") }),
      ),
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    fireEvent.click(await screen.findByRole("button", { name: "Mark paid" }));

    // Cancelling also moves stock, so a status change that silently failed
    // would leave staff believing the shop is in a state it is not.
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/cannot become/i),
    );
  });
});
