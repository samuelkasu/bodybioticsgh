import { AdminGuard } from "@/components/admin/AdminGuard";
import { renderWithProviders, screen } from "@/test/test-utils";

const session = (user: unknown) =>
  new Response(JSON.stringify({ data: { user } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const staff = { id: "u1", email: "staff@bodybiotics.test", name: null, role: "ADMIN" };
const customer = { id: "u2", email: "ama@example.com", name: "Ama", role: "CUSTOMER" };

describe("AdminGuard", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("shows the admin screens to staff", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(session(staff)));

    renderWithProviders(
      <AdminGuard>
        <p>Order queue</p>
      </AdminGuard>,
    );

    expect(await screen.findByText("Order queue")).toBeInTheDocument();
  });

  it("hides them from a signed-in customer", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(session(customer)));

    renderWithProviders(
      <AdminGuard>
        <p>Order queue</p>
      </AdminGuard>,
    );

    expect(await screen.findByText(/not available on this account/i)).toBeInTheDocument();
    expect(screen.queryByText("Order queue")).not.toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(session(null)));

    renderWithProviders(
      <AdminGuard>
        <p>Order queue</p>
      </AdminGuard>,
    );

    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/account/login?next=/admin",
    );
  });
});
