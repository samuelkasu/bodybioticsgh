import sitemap from "@/app/sitemap";
import { listAllProductSlugs, listProductTags, listTermSlugs } from "@/lib/api/server";

jest.mock("@/lib/api/server", () => ({
  listAllProductSlugs: jest.fn(),
  listProductTags: jest.fn(),
  listTermSlugs: jest.fn(),
}));

const mockedProducts = listAllProductSlugs as jest.MockedFunction<
  typeof listAllProductSlugs
>;
const mockedTerms = listTermSlugs as jest.MockedFunction<typeof listTermSlugs>;
const mockedTags = listProductTags as jest.MockedFunction<typeof listProductTags>;

const tag = (slug: string) => ({
  slug,
  name: slug,
  intro: "",
  query: { category: null, brand: null, search: null },
});

const urls = (entries: Awaited<ReturnType<typeof sitemap>>) =>
  entries.map((entry) => entry.url);

describe("sitemap", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("lists every product, category and brand at its storefront URL", async () => {
    mockedProducts.mockResolvedValue(["vitamin-c-serum", "shea-body-butter"]);
    mockedTerms.mockImplementation(async (kind) =>
      kind === "categories" ? ["serums"] : ["cerave"],
    );
    mockedTags.mockResolvedValue([tag("turmeric")]);

    const found = urls(await sitemap());

    expect(found).toContain("http://localhost:3000/product/vitamin-c-serum");
    expect(found).toContain("http://localhost:3000/product/shea-body-butter");
    expect(found).toContain("http://localhost:3000/category/serums");
    expect(found).toContain("http://localhost:3000/brand/cerave");
    expect(found).toContain("http://localhost:3000/product-tag/turmeric");
  });

  it("still lists the static routes when the catalogue cannot be read", async () => {
    // What happens in CI: the frontend builds with no API and no database.
    // A sitemap holding only the static pages is recoverable; a failed build
    // is not.
    mockedProducts.mockResolvedValue([]);
    mockedTerms.mockResolvedValue([]);
    mockedTags.mockResolvedValue([]);

    const found = urls(await sitemap());

    expect(found).toContain("http://localhost:3000/");
    expect(found).toContain("http://localhost:3000/shop");
    expect(found.some((url) => url.includes("/product/"))).toBe(false);
  });

  it("never advertises a page a customer cannot be sent to cold", async () => {
    mockedProducts.mockResolvedValue([]);
    mockedTerms.mockResolvedValue([]);
    mockedTags.mockResolvedValue([]);

    const found = urls(await sitemap());

    // Mirrors the disallow list in robots.ts: cart, checkout, account and
    // order pages are per-customer and must not be indexed.
    for (const path of ["/cart", "/checkout", "/account", "/order", "/offline"]) {
      expect(found.some((url) => url.includes(path))).toBe(false);
    }
  });
});
