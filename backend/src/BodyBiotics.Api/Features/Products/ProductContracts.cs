using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Products;

/// <summary>
/// Wire shape for the storefront. Mapped explicitly from the entity so a new
/// internal column (cost price, supplier) cannot leak by being added to a model.
/// </summary>
public sealed record ProductDto(
    string Id,
    string Slug,
    string Name,
    string Description,
    string? Sku,
    /// <summary>
    /// What this costs today — the sale price while a sale is running, the
    /// list price otherwise. Deliberately still called `priceMinor`: every
    /// place that displays or adds to a cart reads the price to charge, and
    /// giving the discounted figure that name is what keeps a sale from
    /// having to be remembered at each of them.
    /// </summary>
    int PriceMinor,
    /// <summary>
    /// The struck-through "was" price, or null when nothing is struck through.
    /// </summary>
    int? CompareAtPriceMinor,
    /// <summary>Whole percent off, for the badge on the card. Null when not on sale.</summary>
    int? DiscountPercent,
    /// <summary>When the running sale stops, so the storefront can count down.</summary>
    DateTimeOffset? SaleEndsAt,
    string Currency,
    string ImageUrl,
    string? HoverImageUrl,
    bool InStock,
    /// <summary>
    /// How many are left, but only once that number is small enough to matter
    /// to a customer — null otherwise.
    ///
    /// The exact figure stays in AdminProductDto: a public endpoint printing
    /// full inventory hands a competitor the shop's sales figures. "Five or
    /// fewer" is not that, it is the urgency cue a shopper needs to decide, and
    /// it is what lets the quantity stepper stop them from ordering eight of
    /// something the shop has two of.
    /// </summary>
    int? LowStockRemaining,
    string? CategorySlug,
    string? CategoryName,
    string? BrandSlug,
    string? BrandName)
{
    /// <summary>At or below this, the count is worth telling a customer.</summary>
    public const int LowStockThreshold = 5;

    public static ProductDto From(Product product) => From(product, [], DateTimeOffset.UtcNow);

    /// <summary>
    /// The card as a customer sees it, with any running campaign already in
    /// the price. The figures come from <see cref="PricingService.DisplayPrice"/>,
    /// which runs the same engine checkout charges with — so a card cannot
    /// advertise a price the till will not honour.
    /// </summary>
    public static ProductDto From(
        Product product,
        IReadOnlyList<Promotion> promotions,
        DateTimeOffset now)
    {
        var price = PricingService.DisplayPrice(product, promotions, now);

        return new ProductDto(
            product.Id,
            product.Slug,
            product.Name,
            product.Description,
            product.Sku,
            price.PriceMinor,
            price.CompareAtPriceMinor,
            price.DiscountPercent,
            price.EndsAt,
            product.Currency,
            product.ImageUrl,
            product.HoverImageUrl,
            product.Stock > 0,
            product.Stock is > 0 and <= LowStockThreshold ? product.Stock : null,
            product.Category?.Slug,
            product.Category?.Name,
            product.Brand?.Slug,
            product.Brand?.Name);
    }
}

/// <summary>Detail view: the card data plus gallery and related products.</summary>
public sealed record ProductDetailDto(
    ProductDto Product,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<ProductDto> Related);

public sealed record ProductImageDto(string Url, int Width);

public sealed record PagedDto<T>(IReadOnlyList<T> Items, int Page, int PerPage, int Total);

/// <summary>
/// A tag archive and the catalogue filters it stands for, so the storefront can
/// hand the query straight to the product list.
/// </summary>
public sealed record ProductTagDto(
    string Slug,
    string Name,
    string Intro,
    ProductTagQueryDto Query)
{
    public static ProductTagDto From(ProductTag tag) => new(
        tag.Slug,
        tag.Name,
        tag.Intro,
        new ProductTagQueryDto(tag.CategorySlugs, tag.BrandSlugs, tag.Search));
}

public sealed record ProductTagQueryDto(string? Category, string? Brand, string? Search);

public sealed record ProductListRequest(
    int Page = 1,
    int PerPage = 12,
    string? Search = null,
    string? Category = null,
    string? Brand = null,
    int? MinPrice = null,
    int? MaxPrice = null,
    string? Sort = null,
    string? Letter = null);

public sealed record PriceRangeDto(int MinMinor, int MaxMinor);

public sealed class ProductListRequestValidator : AbstractValidator<ProductListRequest>
{
    /// <summary>Accepted <c>sort</c> values, echoed in the 400 message.</summary>
    public static readonly string[] SortValues =
        ["latest", "price-asc", "price-desc", "alpha"];

    public ProductListRequestValidator()
    {
        RuleFor(request => request.Page).GreaterThanOrEqualTo(1);
        // Capped: an unbounded perPage is both a slow scan and a data-dump vector.
        RuleFor(request => request.PerPage).InclusiveBetween(1, 48);
        RuleFor(request => request.Search)
            .MaximumLength(80)
            .When(request => request.Search is not null);
        RuleFor(request => request.Category)
            .MaximumLength(160)
            .When(request => request.Category is not null);
        RuleFor(request => request.Brand)
            .MaximumLength(160)
            .When(request => request.Brand is not null);
        RuleFor(request => request.MinPrice)
            .GreaterThanOrEqualTo(0)
            .When(request => request.MinPrice is not null);
        RuleFor(request => request.MaxPrice)
            .GreaterThanOrEqualTo(0)
            .When(request => request.MaxPrice is not null);
        RuleFor(request => request.MaxPrice)
            .GreaterThanOrEqualTo(request => request.MinPrice)
            .When(request => request.MinPrice is not null && request.MaxPrice is not null)
            .WithMessage("'Max Price' must not be below 'Min Price'.");
        RuleFor(request => request.Sort)
            .Must(sort => sort is null || SortValues.Contains(sort))
            .WithMessage($"'Sort' must be one of: {string.Join(", ", SortValues)}.");
        // A single letter only: the value reaches the database inside a LIKE
        // pattern, where '%' or '_' would quietly widen the match.
        RuleFor(request => request.Letter)
            .Must(letter => string.IsNullOrWhiteSpace(letter)
                || (letter.Length == 1 && char.IsAsciiLetter(letter[0])))
            .WithMessage("'Letter' must be a single letter A-Z.");
    }
}

public static class ProductQueryMapper
{
    public static ProductQuery ToQuery(this ProductListRequest request) => new()
    {
        Page = request.Page,
        PerPage = request.PerPage,
        Search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim(),
        CategorySlug = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category,
        BrandSlug = string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand,
        MinPriceMinor = request.MinPrice,
        MaxPriceMinor = request.MaxPrice,
        Letter = string.IsNullOrWhiteSpace(request.Letter) ? null : request.Letter.Trim(),
        Sort = request.Sort switch
        {
            "price-asc" => ProductSort.PriceAscending,
            "price-desc" => ProductSort.PriceDescending,
            "alpha" => ProductSort.Alphabetical,
            _ => ProductSort.Latest,
        },
    };
}
