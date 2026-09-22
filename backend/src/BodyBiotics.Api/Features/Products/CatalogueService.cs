using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using FluentValidation;

namespace BodyBiotics.Api.Features.Products;

/// <summary>
/// Application service for the storefront catalogue. Endpoints stay thin and
/// delegate here, so the listing rules are testable without an HTTP pipeline.
/// </summary>
public sealed class CatalogueService(
    IProductRepository products,
    ICategoryRepository categories,
    IBrandRepository brands,
    IProductTagRepository tags,
    IPromotionRepository promotions,
    IValidator<ProductListRequest> validator)
{
    /// <summary>Related products shown under a product; one row on a phone, two on desktop.</summary>
    private const int RelatedCount = 4;

    public async Task<PagedDto<ProductDto>> ListAsync(
        ProductListRequest request,
        CancellationToken cancellationToken)
    {
        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var page = await products.SearchAsync(request.ToQuery(), cancellationToken);

        // One read for the whole page, not one per card. A shop runs a handful
        // of campaigns, so this is a small query and the pricing that follows
        // is arithmetic over a list already in memory.
        var now = DateTimeOffset.UtcNow;
        var live = await promotions.ListLiveAsync(now, cancellationToken);

        return new PagedDto<ProductDto>(
            [.. page.Items.Select(product => ProductDto.From(product, live, now))],
            page.Page,
            page.PerPage,
            page.Total);
    }

    /// <summary>Bounds for the storefront's price slider.</summary>
    public async Task<PriceRangeDto> GetPriceRangeAsync(CancellationToken cancellationToken)
    {
        var range = await products.GetPriceRangeAsync(cancellationToken);
        return new PriceRangeDto(range.MinMinor, range.MaxMinor);
    }

    public async Task<ProductDetailDto> GetBySlugAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        var product = await products.FindBySlugAsync(slug, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No product with slug \"{slug}\"");

        var related = await products.FindRelatedAsync(product, RelatedCount, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var live = await promotions.ListLiveAsync(now, cancellationToken);

        return new ProductDetailDto(
            ProductDto.From(product, live, now),
            [.. product.Images
                .OrderBy(image => image.SortOrder)
                .Select(image => new ProductImageDto(image.Url, image.Width))],
            [.. related.Select(item => ProductDto.From(item, live, now))]);
    }

    public async Task<IReadOnlyList<CategorySummary>> ListCategoriesAsync(
        CancellationToken cancellationToken) =>
        await categories.ListAsync(cancellationToken);

    public async Task<IReadOnlyList<BrandSummary>> ListBrandsAsync(
        CancellationToken cancellationToken) =>
        await brands.ListAsync(cancellationToken);

    /// <summary>
    /// Archive header data. Resolving the term separately means an unknown
    /// slug is a 404 instead of a silently empty product grid.
    /// </summary>
    public async Task<CategorySummary> GetCategoryAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        var category = await categories.FindBySlugAsync(slug, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No category with slug \"{slug}\"");

        var all = await categories.ListAsync(cancellationToken);
        return all.FirstOrDefault(summary => summary.Slug == slug)
            ?? new CategorySummary(category.Slug, category.Name, 0);
    }

    public async Task<IReadOnlyList<ProductTagDto>> ListTagsAsync(
        CancellationToken cancellationToken) =>
        [.. (await tags.ListAsync(cancellationToken)).Select(ProductTagDto.From)];

    public async Task<ProductTagDto> GetTagAsync(string slug, CancellationToken cancellationToken)
    {
        var tag = await tags.FindBySlugAsync(slug, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No tag with slug \"{slug}\"");

        return ProductTagDto.From(tag);
    }

    public async Task<BrandSummary> GetBrandAsync(string slug, CancellationToken cancellationToken)
    {
        var brand = await brands.FindBySlugAsync(slug, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, $"No brand with slug \"{slug}\"");

        var all = await brands.ListAsync(cancellationToken);
        return all.FirstOrDefault(summary => summary.Slug == slug)
            ?? new BrandSummary(brand.Slug, brand.Name, 0);
    }
}
