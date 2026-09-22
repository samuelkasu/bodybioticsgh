export type Currency = "GHS" | "USD";

/** Mirrors ProductDto in backend/src/BodyBiotics.Api/Features/Products. */
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sku: string | null;
  /**
   * What it costs today, in minor units (pesewas) — the sale price while a
   * sale is running. Format only at render.
   */
  priceMinor: number;
  /** The struck-through "was" price. Null when the product is not on sale. */
  compareAtPriceMinor: number | null;
  /** Whole percent off, for the badge. Null when not on sale. */
  discountPercent: number | null;
  /** When the running sale stops. Null when there is no sale. */
  saleEndsAt: string | null;
  currency: Currency;
  imageUrl: string;
  /** Second photo, faded in while the card is hovered. Null when there is only one. */
  hoverImageUrl: string | null;
  inStock: boolean;
  /**
   * Units left, but only once it is low enough to be worth saying — null
   * otherwise. The API withholds exact inventory for healthy stock on purpose
   * (see ProductDto), so this is a cue, not a count to rely on.
   */
  lowStockRemaining: number | null;
  categorySlug: string | null;
  categoryName: string | null;
  brandSlug: string | null;
  brandName: string | null;
};

export type ProductImage = {
  url: string;
  width: number;
};

export type ProductDetail = {
  product: Product;
  images: ProductImage[];
  related: Product[];
};

export type ProductSort = "latest" | "price-asc" | "price-desc" | "alpha";

export type ProductListQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  /** Single letter: names starting with it, for the A–Z filter. */
  letter?: string;
};

/** Catalogue price bounds in minor units; bounds the shop's price slider. */
export type PriceRange = {
  minMinor: number;
  maxMinor: number;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
};

export type TermSummary = {
  slug: string;
  name: string;
  productCount: number;
};

/**
 * A tag archive, served by the API. The old site never exported a real
 * tag-to-product mapping, so a tag is stored as the catalogue query that
 * reproduces its archive. Mirrors ProductTagDto on the backend.
 */
export type ProductTag = {
  slug: string;
  name: string;
  intro: string;
  /** Comma-separated slugs, like the shop's own filters; null when unset. */
  query: {
    category: string | null;
    brand: string | null;
    search: string | null;
  };
};

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "alpha", label: "Name: A to Z" },
];

export const PRODUCTS_PER_PAGE = 24;

/** Total pages for a result set; 0 when there is nothing to page through. */
export const pageCount = (total: number, perPage: number): number =>
  perPage <= 0 ? 0 : Math.ceil(total / perPage);
