using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Abstractions;

public enum ProductSort
{
    Latest = 0,
    PriceAscending = 1,
    PriceDescending = 2,
    Alphabetical = 3,
}

/// <summary>
/// Everything the storefront can narrow a product list by. A record rather
/// than a long parameter list so adding a filter does not ripple through
/// every caller.
/// </summary>
public sealed record ProductQuery
{
    public int Page { get; init; } = 1;
    public int PerPage { get; init; } = 12;
    public string? Search { get; init; }
    public string? CategorySlug { get; init; }
    public string? BrandSlug { get; init; }
    public int? MinPriceMinor { get; init; }
    public int? MaxPriceMinor { get; init; }
    /// <summary>First letter of the product name, for the A–Z filter.</summary>
    public string? Letter { get; init; }
    public ProductSort Sort { get; init; } = ProductSort.Latest;

    public int Skip => (Page - 1) * PerPage;
}

/// <summary>Cheapest and dearest active product, in minor units. Bounds the price slider.</summary>
public sealed record PriceRange(int MinMinor, int MaxMinor);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PerPage, int Total)
{
    public int TotalPages => PerPage <= 0 ? 0 : (int)Math.Ceiling(Total / (double)PerPage);
}

/// <summary>
/// Intent-revealing methods only: no IQueryable escapes the repository, so the
/// database provider stays an implementation detail and services can be tested
/// against a fake.
/// </summary>
public interface IProductRepository
{
    Task<PagedResult<Product>> SearchAsync(ProductQuery query, CancellationToken cancellationToken);

    Task<Product?> FindBySlugAsync(string slug, CancellationToken cancellationToken);

    Task<IReadOnlyList<Product>> FindRelatedAsync(Product product, int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<Product>> FindByIdsAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken);

    Task<PriceRange> GetPriceRangeAsync(CancellationToken cancellationToken);
}

public sealed record CategorySummary(string Slug, string Name, int ProductCount);

public interface ICategoryRepository
{
    Task<IReadOnlyList<CategorySummary>> ListAsync(CancellationToken cancellationToken);

    Task<Category?> FindBySlugAsync(string slug, CancellationToken cancellationToken);
}

public sealed record BrandSummary(string Slug, string Name, int ProductCount);

public interface IBrandRepository
{
    Task<IReadOnlyList<BrandSummary>> ListAsync(CancellationToken cancellationToken);

    Task<Brand?> FindBySlugAsync(string slug, CancellationToken cancellationToken);
}

public interface IProductTagRepository
{
    Task<IReadOnlyList<ProductTag>> ListAsync(CancellationToken cancellationToken);

    Task<ProductTag?> FindBySlugAsync(string slug, CancellationToken cancellationToken);
}
