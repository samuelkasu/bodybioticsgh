import { baseApi } from "@/lib/api/baseApi";
import type {
  Paginated,
  PriceRange,
  Product,
  ProductDetail,
  ProductListQuery,
  ProductTag,
  TermSummary,
} from "@/lib/features/products/types";
import { PRODUCTS_PER_PAGE } from "@/lib/features/products/types";

/** Drops empty values so the request URL stays clean and cache keys stay stable. */
const toParams = (query: ProductListQuery | void): Record<string, string | number> => {
  const params: Record<string, string | number> = {
    page: query?.page ?? 1,
    perPage: query?.perPage ?? PRODUCTS_PER_PAGE,
  };

  if (query?.search) params["search"] = query.search;
  if (query?.category) params["category"] = query.category;
  if (query?.brand) params["brand"] = query.brand;
  if (query?.minPrice !== undefined) params["minPrice"] = query.minPrice;
  if (query?.maxPrice !== undefined) params["maxPrice"] = query.maxPrice;
  if (query?.sort) params["sort"] = query.sort;
  if (query?.letter) params["letter"] = query.letter;

  return params;
};

export const productsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProducts: build.query<Paginated<Product>, ProductListQuery | void>({
      query: (params) => ({ url: "/products", params: toParams(params) }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: "Product" as const, id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),

    getPriceRange: build.query<PriceRange, void>({
      query: () => ({ url: "/products/price-range" }),
      providesTags: [{ type: "Product", id: "PRICE_RANGE" }],
    }),

    getProductBySlug: build.query<ProductDetail, string>({
      query: (slug) => ({ url: `/products/${slug}` }),
      providesTags: (result) =>
        result ? [{ type: "Product" as const, id: result.product.id }] : [],
    }),

    getCategories: build.query<TermSummary[], void>({
      query: () => ({ url: "/categories" }),
      providesTags: [{ type: "Product", id: "CATEGORIES" }],
    }),

    getCategory: build.query<TermSummary, string>({
      query: (slug) => ({ url: `/categories/${slug}` }),
    }),

    getBrands: build.query<TermSummary[], void>({
      query: () => ({ url: "/brands" }),
      providesTags: [{ type: "Product", id: "BRANDS" }],
    }),

    getBrand: build.query<TermSummary, string>({
      query: (slug) => ({ url: `/brands/${slug}` }),
    }),

    getTags: build.query<ProductTag[], void>({
      query: () => ({ url: "/tags" }),
      providesTags: [{ type: "Product", id: "TAGS" }],
    }),

    getTag: build.query<ProductTag, string>({
      query: (slug) => ({ url: `/tags/${slug}` }),
    }),
  }),
});

export const {
  useGetProductsQuery,
  useLazyGetProductsQuery,
  useGetPriceRangeQuery,
  useGetProductBySlugQuery,
  useGetCategoriesQuery,
  useGetCategoryQuery,
  useGetBrandsQuery,
  useGetBrandQuery,
  useGetTagsQuery,
  useGetTagQuery,
} = productsApi;
