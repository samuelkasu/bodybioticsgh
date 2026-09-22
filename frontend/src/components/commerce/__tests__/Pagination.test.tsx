import { Pagination, pageWindow } from "@/components/commerce/Pagination";
import { render, screen } from "@/test/test-utils";

const buildHref = (page: number) => `/shop?page=${page}`;

describe("pageWindow", () => {
  it("keeps the first and last page visible", () => {
    expect(pageWindow(8, 15)).toEqual([1, 7, 8, 9, 15]);
  });

  it("does not duplicate pages near the start", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 5]);
  });

  it("does not run past the last page", () => {
    expect(pageWindow(5, 5)).toEqual([1, 4, 5]);
  });

  it("handles a single page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} buildHref={buildHref} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page for assistive technology", () => {
    render(<Pagination page={3} totalPages={10} buildHref={buildHref} />);

    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("disables Prev on the first page", () => {
    render(<Pagination page={1} totalPages={10} buildHref={buildHref} />);

    expect(screen.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    expect(screen.getByText("Prev")).toHaveAttribute("aria-disabled", "true");
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={10} totalPages={10} buildHref={buildHref} />);

    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
    expect(screen.getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });

  it("builds hrefs through the caller so filters survive paging", () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        buildHref={(page) => `/shop?category=toner&page=${page}`}
      />,
    );

    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/shop?category=toner&page=3",
    );
  });

  it("shows an ellipsis where pages are skipped", () => {
    render(<Pagination page={8} totalPages={15} buildHref={buildHref} />);

    expect(screen.getAllByText("…")).toHaveLength(2);
  });
});
