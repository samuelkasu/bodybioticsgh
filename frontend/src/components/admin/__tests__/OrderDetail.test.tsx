import { OrderDetail } from "@/components/admin/OrderDetail";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const order = (status: string, overrides: Record<string, unknown> = {}) => ({
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
      discountMinor: 0,
      restockedQuantity: 0,
    },
  ],
  paymentMethod: "ON_DELIVERY",
  paidAt: null,
  amountPaidMinor: 0,
  refundedMinor: 0,
  refundableMinor: 0,
  deliveries: [],
  refunds: [],
  ...overrides,
});

/** Records what each POST sent, and answers every GET with the given order. */
const routed = (
  fetchMock: jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>,
  current: () => unknown,
  onPost: (url: string, body: Record<string, unknown>) => Response,
) =>
  fetchMock.mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    if (request.method === "POST") {
      return onPost(request.url, (await request.json()) as Record<string, unknown>);
    }
    return json({ data: current() });
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
    // A pending order cannot be delivered before it goes out.
    expect(
      screen.queryByRole("button", { name: "Mark delivered" }),
    ).not.toBeInTheDocument();
    // Pay on delivery goes out unpaid.
    expect(
      screen.getByRole("button", { name: "Send out for delivery" }),
    ).toBeInTheDocument();
  });

  it("holds an unpaid online order back from delivery", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ data: order("PENDING", { paymentMethod: "HUBTEL" }) })),
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    expect(await screen.findByRole("button", { name: "Mark paid" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send out for delivery" }),
    ).not.toBeInTheDocument();
  });

  it("dispatches with the rider's details", async () => {
    const posts: { url: string; body: Record<string, unknown> }[] = [];
    routed(
      fetchMock,
      () => order("PENDING"),
      (url, body) => {
        posts.push({ url, body });
        return json({ data: order("DISPATCHED") });
      },
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    fireEvent.click(await screen.findByRole("button", { name: "Send out for delivery" }));
    fireEvent.change(screen.getByLabelText("Rider's name"), {
      target: { value: "Kofi Boateng" },
    });
    fireEvent.change(screen.getByLabelText("Their phone"), {
      target: { value: "0241112222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dispatch" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.url).toMatch(/\/dispatch$/);
    expect(posts[0]!.body).toEqual({
      method: "RIDER",
      riderName: "Kofi Boateng",
      riderPhone: "0241112222",
    });
  });

  it("asks what the rider collected when delivering a pay-on-delivery order", async () => {
    const posts: Record<string, unknown>[] = [];
    const trip = {
      id: "d1",
      method: "RIDER",
      courierName: null,
      riderName: "Kofi Boateng",
      riderPhone: "0241112222",
      notes: null,
      status: "OUT_FOR_DELIVERY",
      dispatchedAt: "2026-09-23T09:00:00Z",
      deliveredAt: null,
      failedAt: null,
      failureReason: null,
      collectedMinor: null,
      collectedVia: null,
    };
    routed(
      fetchMock,
      () => order("DISPATCHED", { deliveries: [trip] }),
      (_url, body) => {
        posts.push(body);
        return json({ data: order("FULFILLED") });
      },
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    fireEvent.click(await screen.findByRole("button", { name: "Mark delivered" }));
    fireEvent.change(screen.getByLabelText("Paid by"), {
      target: { value: "mobilemoney" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delivered" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    // Prefilled with the total, in pesewas on the wire.
    expect(posts[0]).toEqual({ collectedMinor: 25_000, collectedVia: "mobilemoney" });
  });

  it("records a partial refund with units back to stock", async () => {
    const posts: Record<string, unknown>[] = [];
    routed(
      fetchMock,
      () =>
        order("FULFILLED", {
          paidAt: "2026-09-23T09:00:00Z",
          amountPaidMinor: 25_000,
          refundableMinor: 25_000,
        }),
      (_url, body) => {
        posts.push(body);
        return json({ data: order("FULFILLED") });
      },
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    fireEvent.click(await screen.findByRole("button", { name: "Record refund" }));
    fireEvent.change(screen.getByLabelText("Amount (₵)"), { target: { value: "125" } });
    fireEvent.change(screen.getByLabelText("Transaction reference"), {
      target: { value: "MM-1" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "One returned unopened" },
    });
    fireEvent.change(screen.getByLabelText("Glow Serum (up to 2)"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Record refund" }).at(-1)!);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      amountMinor: 12_500,
      method: "MOBILE_MONEY",
      reason: "One returned unopened",
      reference: "MM-1",
      restock: [{ productId: "p1", quantity: 1 }],
    });
  });

  it("will not offer more than is left to refund", async () => {
    routed(
      fetchMock,
      () =>
        order("PAID", {
          paidAt: "2026-09-23T09:00:00Z",
          amountPaidMinor: 25_000,
          refundedMinor: 20_000,
          refundableMinor: 5_000,
        }),
      () => json({ data: order("PAID") }),
    );

    renderWithProviders(<OrderDetail reference="BB-20260917-K7QX4M9T" />);

    fireEvent.click(await screen.findByRole("button", { name: "Record refund" }));
    fireEvent.change(screen.getByLabelText("Amount (₵)"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Late" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Record refund" }).at(-1)!);

    expect(
      await screen.findByText(/up to/i, { selector: "[role=alert]" }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input]) => input instanceof Request && input.method === "POST",
      ),
    ).toBe(false);
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
