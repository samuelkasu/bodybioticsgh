import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { makeProduct } from "@/test/fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/test-utils";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: (url: string) => push(url) }),
}));

const tags = [
  { slug: "face-wash", name: "Face Wash", intro: "", query: {} },
  { slug: "body-lotion", name: "Body Lotion", intro: "", query: {} },
];

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const jsonResponse = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ data: body }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("SearchOverlay", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    push.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    // Routed by path, because the panel asks for tags and products at once.
    // fetchBaseQuery hands fetch a Request, not a string — String(input) on one
    // is "[object Request]", which silently routes every call to the fallback.
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);

      if (url.includes("/tags")) return jsonResponse(tags);

      if (url.includes("search=serum")) {
        return jsonResponse({
          items: [makeProduct({ id: "p9", name: "Glow Serum" })],
          page: 1,
          perPage: 6,
          total: 12,
        });
      }

      if (url.includes("search=")) {
        return jsonResponse({ items: [], page: 1, perPage: 6, total: 0 });
      }

      return jsonResponse({
        items: [makeProduct({ id: "p1", name: "Night Cream" })],
        page: 1,
        perPage: 6,
        total: 1,
      });
    });
  });

  it("renders nothing while closed", () => {
    renderWithProviders(<SearchOverlay open={false} onClose={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers popular searches and recommendations before anything is typed", async () => {
    renderWithProviders(<SearchOverlay open onClose={jest.fn()} />);

    expect(await screen.findByText("Face Wash")).toBeInTheDocument();
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(await screen.findByText("Night Cream")).toBeInTheDocument();
  });

  it("shows matching products as you type, without leaving the panel", async () => {
    renderWithProviders(<SearchOverlay open onClose={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Search products"), "serum");

    expect(await screen.findByText("Glow Serum")).toBeInTheDocument();
    // The total from the server, not the handful shown.
    expect(screen.getByText("See all 12")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("does not search on a single letter", async () => {
    renderWithProviders(<SearchOverlay open onClose={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Search products"), "a");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.some(([input]) => urlOf(input).includes("search=a")),
    ).toBe(false);
  });

  it("goes to the shop on submit and closes", async () => {
    const onClose = jest.fn();
    renderWithProviders(<SearchOverlay open onClose={onClose} />);

    const input = screen.getByLabelText("Search products");
    await userEvent.type(input, "serum{Enter}");

    expect(push).toHaveBeenCalledWith("/shop?q=serum");
    expect(onClose).toHaveBeenCalled();
  });

  it("clears the box without closing the panel", async () => {
    // The two used to be adjacent crosses. They are now a word and an icon,
    // and this is the test that says they do different things.
    const onClose = jest.fn();
    renderWithProviders(<SearchOverlay open onClose={onClose} />);

    const input = screen.getByLabelText("Search products");
    await userEvent.type(input, "serum");

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(input).toHaveValue("");
    expect(onClose).not.toHaveBeenCalled();
    // Back to the resting panel, not to an empty result.
    expect(await screen.findByText("Recommendations")).toBeInTheDocument();
  });

  it("offers a way out when nothing matches", async () => {
    renderWithProviders(<SearchOverlay open onClose={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Search products"), "zzzzz");

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the whole shop" }),
    ).toBeInTheDocument();
    // The popular searches come back as the way on from a dead end.
    expect(screen.getByText("Or try one of these")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Face Wash" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = jest.fn();
    renderWithProviders(<SearchOverlay open onClose={onClose} />);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("releases the page scroll it locked when it closes", () => {
    const { rerender } = renderWithProviders(<SearchOverlay open onClose={jest.fn()} />);

    expect(document.body.style.overflow).toBe("hidden");

    rerender(<SearchOverlay open={false} onClose={jest.fn()} />);

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
