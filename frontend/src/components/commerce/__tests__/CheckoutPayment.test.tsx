import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { makeStore } from "@/lib/store/store";
import { leaveApp } from "@/lib/utils/navigate";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

jest.mock("@/lib/utils/navigate", () => ({ leaveApp: jest.fn() }));

// The form pushes to /order/<reference> for a pay-on-delivery order; there is
// no app-router context in a unit test.
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const assign = leaveApp as jest.MockedFunction<typeof leaveApp>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const order = (extra: Record<string, unknown> = {}) => ({
  reference: "BB-20260917-K7QX4M9T",
  status: "PENDING",
  email: "ama@example.com",
  fullName: "Ama Mensah",
  phone: "0241234567",
  addressLine: "12 Oxford Street",
  city: "Accra",
  deliveryZone: "accra-central",
  deliveryZoneName: "Accra Central, Osu, Labone",
  notes: null,
  paymentMethod: "ON_DELIVERY",
  checkoutUrl: null,
  isPaid: false,
  subtotalMinor: 23_000,
  deliveryFeeMinor: 2_000,
  totalMinor: 25_000,
  currency: "GHS",
  createdAt: "2026-09-17T09:00:00Z",
  lines: [],
  ...extra,
});

/**
 * Routes by URL so the component's several parallel requests (payment methods,
 * cart, checkout) each get the right answer regardless of call order.
 */
function route(handlers: {
  methods?: unknown;
  checkout?: unknown;
  checkoutStatus?: number;
}) {
  return (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);

    if (url.includes("/delivery-options")) {
      return Promise.resolve(
        json({
          data: {
            zones: [
              {
                code: "accra-central",
                name: "Accra Central, Osu, Labone",
                feeMinor: 2_000,
                estimate: "Same or next working day",
              },
            ],
            freeDeliveryThresholdMinor: 200_000,
            currency: "GHS",
          },
        }),
      );
    }

    if (url.includes("/payments/methods")) {
      return Promise.resolve(
        json({ data: handlers.methods ?? { onDelivery: true, hubtel: false } }),
      );
    }

    if (url.includes("/checkout")) {
      return Promise.resolve(
        json(handlers.checkout ?? { data: order() }, handlers.checkoutStatus ?? 200),
      );
    }

    return Promise.resolve(
      json({
        data: {
          lines: [],
          itemCount: 0,
          subtotalMinor: 0,
          currency: "GHS",
          hasUnavailableLines: false,
        },
      }),
    );
  };
}

const fill = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: "Ama Mensah" },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "ama@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/phone/i), {
    target: { value: "0241234567" },
  });
  fireEvent.change(screen.getByLabelText(/address/i), {
    target: { value: "12 Oxford Street" },
  });
  fireEvent.change(screen.getByLabelText(/town or city|city/i), {
    target: { value: "Accra" },
  });
  // Required: it is what prices delivery, and the order cannot be totalled
  // without it.
  fireEvent.change(screen.getByLabelText(/delivery area/i), {
    target: { value: "accra-central" },
  });
};

describe("CheckoutForm payment method", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    assign.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("does not offer online payment when the provider is not configured", async () => {
    fetchMock.mockImplementation(route({ methods: { onDelivery: true, hubtel: false } }));

    renderWithProviders(<CheckoutForm />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByLabelText(/pay now/i)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /place order/i }),
    ).toBeInTheDocument();
  });

  it("offers both methods when Hubtel is configured, defaulting to pay on delivery", async () => {
    fetchMock.mockImplementation(route({ methods: { onDelivery: true, hubtel: true } }));

    renderWithProviders(<CheckoutForm />);

    const onDelivery = await screen.findByRole("radio", { name: /pay on delivery/i });
    const payNow = screen.getByRole("radio", { name: /pay now/i });

    // The safer option is preselected: a customer who never touches this still
    // gets the flow the shop has always run.
    expect(onDelivery).toBeChecked();
    expect(payNow).not.toBeChecked();
  });

  it("sends the customer to Hubtel when they choose to pay now", async () => {
    fetchMock.mockImplementation(
      route({
        methods: { onDelivery: true, hubtel: true },
        checkout: {
          data: order({
            paymentMethod: "HUBTEL",
            checkoutUrl: "https://checkout.hubtel.com/abc123",
          }),
        },
      }),
    );

    renderWithProviders(<CheckoutForm />, { store: makeStore() });

    fireEvent.click(await screen.findByRole("radio", { name: /pay now/i }));
    fill();
    fireEvent.click(screen.getByRole("button", { name: /^pay /i }));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://checkout.hubtel.com/abc123"),
    );
  });

  it("surfaces the API's own message when the provider is unreachable", async () => {
    fetchMock.mockImplementation(
      route({
        methods: { onDelivery: true, hubtel: true },
        checkout: {
          error: {
            code: "CONFLICT",
            message:
              "We could not reach the payment provider. Nothing has been charged — try again, or choose pay on delivery.",
          },
        },
        checkoutStatus: 409,
      }),
    );

    renderWithProviders(<CheckoutForm />);

    fireEvent.click(await screen.findByRole("radio", { name: /pay now/i }));
    fill();
    fireEvent.click(screen.getByRole("button", { name: /^pay /i }));

    // "Nothing has been charged" is the part the customer needs; a generic
    // failure message here invites a second attempt and a double order.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nothing has been charged/i,
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
