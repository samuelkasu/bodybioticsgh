import { LostPasswordForm, ResetPasswordForm } from "@/components/account/AuthForms";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("LostPasswordForm", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("asks the API for a link and confirms without naming the account", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ data: { sent: true } })));

    renderWithProviders(<LostPasswordForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "ama@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    // "If that address has an account" — never "we have sent you a link",
    // which would confirm the address is registered to anyone who tried it.
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/if that address has an account/i);
  });

  it("does not call the API for something that is not an email address", async () => {
    renderWithProviders(<LostPasswordForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "ama" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/enter the email address/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers WhatsApp when the shop has no mail provider wired", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          {
            error: {
              code: "CONFLICT",
              message:
                "Password reset by email is not available yet. Contact us on WhatsApp and we will verify you.",
            },
          },
          409,
        ),
      ),
    );

    renderWithProviders(<LostPasswordForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "ama@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not available yet/i);
    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
  });
});

describe("ResetPasswordForm", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const fill = (password: string, confirmation = password) => {
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText(/^repeat new password/i), {
      target: { value: confirmation },
    });
  };

  it("sends the token with the new password and signs the customer in", async () => {
    // RTK Query hands fetch a Request, so the body is on it rather than in an
    // init argument; read it here instead of off the recorded call.
    let sent: unknown;

    fetchMock.mockImplementation(async (input) => {
      sent = input instanceof Request ? await input.clone().json() : undefined;
      return json({
        data: { id: "u1", email: "ama@example.com", name: null, role: "CUSTOMER" },
      });
    });

    renderWithProviders(<ResetPasswordForm token="tok-123" />);

    fill("a-long-enough-password");
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/account"));

    expect(sent).toMatchObject({ token: "tok-123", password: "a-long-enough-password" });
  });

  it("catches a mistyped confirmation before it locks the customer out", async () => {
    renderWithProviders(<ResetPasswordForm token="tok-123" />);

    fill("a-long-enough-password", "a-long-enough-passwrod");
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByText(/both passwords must match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a password shorter than the server would accept", async () => {
    renderWithProviders(<ResetPasswordForm token="tok-123" />);

    fill("short");
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("points a link with no token back at the request form", () => {
    renderWithProviders(<ResetPasswordForm token="" />);

    // Someone who copied the URL by hand, or a mail client that mangled it.
    expect(screen.getByRole("alert")).toHaveTextContent(/missing its reset code/i);
    expect(screen.getByRole("link", { name: /request a new link/i })).toBeInTheDocument();
  });

  it("offers a fresh link when the token has expired", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          {
            error: {
              code: "BAD_REQUEST",
              message:
                "That reset link has expired or has already been used. Request a new one.",
            },
          },
          400,
        ),
      ),
    );

    renderWithProviders(<ResetPasswordForm token="stale" />);

    fill("a-long-enough-password");
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired or has already/i);
    expect(screen.getByRole("link", { name: /request a new link/i })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
