using BodyBiotics.Api.Http;

namespace BodyBiotics.Api.Features.Products;

public static class CatalogueEndpoints
{
    public static RouteGroupBuilder MapCatalogueEndpoints(this RouteGroupBuilder api)
    {
        var products = api.MapGroup("/products").WithTags("Catalogue");

        products.MapGet("/", ListProductsAsync).WithName("ListProducts");
        // Literal segment, so it wins over "/{slug}" however they are ordered.
        products.MapGet("/price-range", GetPriceRangeAsync).WithName("GetPriceRange");
        products.MapGet("/{slug}", GetProductAsync).WithName("GetProductBySlug");

        var categories = api.MapGroup("/categories").WithTags("Catalogue");
        categories.MapGet("/", ListCategoriesAsync).WithName("ListCategories");
        categories.MapGet("/{slug}", GetCategoryAsync).WithName("GetCategoryBySlug");

        var brands = api.MapGroup("/brands").WithTags("Catalogue");
        brands.MapGet("/", ListBrandsAsync).WithName("ListBrands");
        brands.MapGet("/{slug}", GetBrandAsync).WithName("GetBrandBySlug");

        var tags = api.MapGroup("/tags").WithTags("Catalogue");
        tags.MapGet("/", ListTagsAsync).WithName("ListProductTags");
        tags.MapGet("/{slug}", GetTagAsync).WithName("GetProductTagBySlug");

        return api;
    }

    // Query parameters are bound individually rather than as a record so that
    // OpenAPI documents them and a missing one keeps its default.
    private static async Task<IResult> ListProductsAsync(
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken,
        int page = 1,
        int perPage = 12,
        string? search = null,
        string? category = null,
        string? brand = null,
        int? minPrice = null,
        int? maxPrice = null,
        string? sort = null,
        string? letter = null)
    {
        var result = await catalogue.ListAsync(
            new ProductListRequest(
                page, perPage, search, category, brand, minPrice, maxPrice, sort, letter),
            cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> GetPriceRangeAsync(
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var range = await catalogue.GetPriceRangeAsync(cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(range);
    }

    private static async Task<IResult> GetProductAsync(
        string slug,
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var product = await catalogue.GetBySlugAsync(slug, cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(product);
    }

    private static async Task<IResult> ListCategoriesAsync(
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var categories = await catalogue.ListCategoriesAsync(cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(categories);
    }

    private static async Task<IResult> GetCategoryAsync(
        string slug,
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var category = await catalogue.GetCategoryAsync(slug, cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(category);
    }

    private static async Task<IResult> ListBrandsAsync(
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var brands = await catalogue.ListBrandsAsync(cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(brands);
    }

    private static async Task<IResult> ListTagsAsync(
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var tags = await catalogue.ListTagsAsync(cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(tags);
    }

    private static async Task<IResult> GetTagAsync(
        string slug,
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var tag = await catalogue.GetTagAsync(slug, cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(tag);
    }

    private static async Task<IResult> GetBrandAsync(
        string slug,
        HttpContext httpContext,
        CatalogueService catalogue,
        CancellationToken cancellationToken)
    {
        var brand = await catalogue.GetBrandAsync(slug, cancellationToken);

        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(brand);
    }
}
