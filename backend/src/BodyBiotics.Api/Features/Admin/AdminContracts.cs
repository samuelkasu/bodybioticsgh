using FluentValidation;

namespace BodyBiotics.Api.Features.Admin;

/// <summary>
/// One row in the orders queue. Carries the delivery details, because the first
/// thing staff do with a new order is ring the number on it.
/// </summary>
public sealed record AdminOrderDto(
    string Reference,
    string Status,
    string Email,
    string FullName,
    string Phone,
    string AddressLine,
    string City,
    /// <summary>Which delivery run this order belongs on.</summary>
    string DeliveryZoneName,
    string? Notes,
    int SubtotalMinor,
    /// <summary>What the offers took off the goods. Zero when none applied.</summary>
    int DiscountMinor,
    /// <summary>The code used, so staff can see why a total is lower than the lines.</summary>
    string? CouponCode,
    string? DiscountDescription,
    /// <summary>What the rider collects on top of the goods, zero when it was free.</summary>
    int DeliveryFeeMinor,
    int TotalMinor,
    string Currency,
    int ItemCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<AdminOrderLineDto> Lines);

public sealed record AdminOrderLineDto(
    string ProductId,
    string Slug,
    string Name,
    int UnitPriceMinor,
    int Quantity,
    int LineTotalMinor,
    /// <summary>This line's share of the discount, for working out a partial refund.</summary>
    int DiscountMinor);

/// <summary>
/// The catalogue as staff need it. Separate from the storefront's ProductDto on
/// purpose: that one exposes only `inStock`, because a public endpoint showing
/// exact inventory hands a competitor the shop's sales figures. Stock levels
/// live here, behind the admin policy.
/// </summary>
public sealed record AdminProductDto(
    string Id,
    string Slug,
    string Name,
    /// <summary>The shelf price. Staff edit this one; a sale is the fields below.</summary>
    int PriceMinor,
    int? SalePriceMinor,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt,
    /// <summary>Whether the sale is running at this moment, as the shop sees it.</summary>
    bool OnSale,
    string Currency,
    int Stock,
    bool Active,
    string ImageUrl,
    string? CategoryName,
    string? BrandName)
{
    public static AdminProductDto From(BodyBiotics.Domain.Entities.Product product) => new(
        product.Id,
        product.Slug,
        product.Name,
        product.PriceMinor,
        product.SalePriceMinor,
        product.SaleStartsAt,
        product.SaleEndsAt,
        product.IsOnSale(DateTimeOffset.UtcNow),
        product.Currency,
        product.Stock,
        product.Active,
        product.ImageUrl,
        product.Category?.Name,
        product.Brand?.Name);
}

public sealed record UpdateOrderStatusRequest(string Status);

/// <summary>
/// Every field optional: staff usually change one thing, and requiring the
/// whole product back means a stale form can silently revert a price someone
/// else just corrected.
/// </summary>
public sealed record UpdateProductRequest(
    int? PriceMinor,
    int? Stock,
    bool? Active,
    /// <summary>What to charge while the sale runs. Below PriceMinor, or it is not a sale.</summary>
    int? SalePriceMinor,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt,
    /// <summary>
    /// Ends the sale and forgets its dates. A separate flag because a JSON
    /// field that is absent and one that is null arrive here identically, and
    /// "leave the sale alone" must not read as "delete it".
    /// </summary>
    bool? ClearSale = null);

public sealed class UpdateOrderStatusRequestValidator
    : AbstractValidator<UpdateOrderStatusRequest>
{
    public UpdateOrderStatusRequestValidator()
    {
        RuleFor(request => request.Status).NotEmpty().MaximumLength(16);
    }
}

public sealed class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        // Mirrors the check constraints on the table: a negative price or stock
        // is rejected here with a readable message rather than as a 500 from
        // Postgres.
        RuleFor(request => request.PriceMinor!.Value)
            .GreaterThanOrEqualTo(0)
            .When(request => request.PriceMinor.HasValue);

        RuleFor(request => request.Stock!.Value)
            .GreaterThanOrEqualTo(0)
            .When(request => request.Stock.HasValue);

        RuleFor(request => request.SalePriceMinor!.Value)
            .GreaterThanOrEqualTo(0)
            .When(request => request.SalePriceMinor.HasValue);

        // A "sale" at or above the shelf price is a mispriced product with a
        // badge on it. Rejected here rather than silently ignored by
        // Product.IsOnSale, so whoever typed it finds out.
        RuleFor(request => request)
            .Must(request => request.SalePriceMinor!.Value < request.PriceMinor!.Value)
            .When(request => request.SalePriceMinor.HasValue && request.PriceMinor.HasValue)
            .WithMessage("'Sale Price' must be below the normal price.");

        RuleFor(request => request)
            .Must(request => request.SaleEndsAt!.Value > request.SaleStartsAt!.Value)
            .When(request => request.SaleStartsAt.HasValue && request.SaleEndsAt.HasValue)
            .WithMessage("A sale cannot end before it starts.");

        RuleFor(request => request)
            .Must(request =>
                request.PriceMinor.HasValue
                || request.Stock.HasValue
                || request.Active.HasValue
                || request.SalePriceMinor.HasValue
                || request.SaleStartsAt.HasValue
                || request.SaleEndsAt.HasValue
                || request.ClearSale == true)
            .WithMessage(
                "Send at least one of priceMinor, stock, active, salePriceMinor, " +
                "saleStartsAt, saleEndsAt or clearSale.");
    }
}
