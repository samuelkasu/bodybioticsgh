using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Cart;

public sealed record CartLineDto(
    string ProductId,
    string Slug,
    string Name,
    string ImageUrl,
    /// <summary>What this costs today: the sale price while a sale is running.</summary>
    int UnitPriceMinor,
    /// <summary>The struck-through "was" price, or null when not on sale.</summary>
    int? CompareAtPriceMinor,
    string Currency,
    int Quantity,
    int LineTotalMinor,
    /// <summary>
    /// This line's share of the basket discount. Shown nowhere by itself — it
    /// is here so the client can render a line the way the receipt will.
    /// </summary>
    int DiscountMinor,
    bool InStock,
    int AvailableStock);

/// <summary>One discount that is actually applying to this basket.</summary>
public sealed record CartDiscountDto(
    /// <summary>"PROMOTION" for an automatic rule, "COUPON" for a typed code.</summary>
    string Source,
    string Label,
    int AmountMinor,
    bool FreeDelivery);

public sealed record CartDto(
    IReadOnlyList<CartLineDto> Lines,
    int ItemCount,
    /// <summary>Goods before any basket discount.</summary>
    int SubtotalMinor,
    int DiscountMinor,
    /// <summary>Goods after discount — what delivery is then priced against.</summary>
    int DiscountedSubtotalMinor,
    string Currency,
    /// <summary>True when a line exceeds what is left in stock; blocks checkout.</summary>
    bool HasUnavailableLines,
    /// <summary>The code currently applied, or null.</summary>
    string? CouponCode,
    IReadOnlyList<CartDiscountDto> Discounts,
    /// <summary>A campaign or code waived delivery outright.</summary>
    bool FreeDeliveryGranted,
    /// <summary>
    /// Why the code that was applied is no longer applying. Null when there is
    /// nothing to say — which is the usual case.
    /// </summary>
    string? CouponMessage);

public sealed record AddToCartRequest(string ProductId, int Quantity = 1);

public sealed record UpdateCartLineRequest(string ProductId, int Quantity);

public sealed record ApplyCouponRequest(string Code);

public sealed class AddToCartRequestValidator : AbstractValidator<AddToCartRequest>
{
    public AddToCartRequestValidator()
    {
        RuleFor(request => request.ProductId).NotEmpty().MaximumLength(32);
        // The upper bound is enforced again in the domain; this rejects the
        // obviously absurd before it reaches the database.
        RuleFor(request => request.Quantity).InclusiveBetween(1, 99);
    }
}

public sealed class UpdateCartLineRequestValidator : AbstractValidator<UpdateCartLineRequest>
{
    public UpdateCartLineRequestValidator()
    {
        RuleFor(request => request.ProductId).NotEmpty().MaximumLength(32);
        // Zero is allowed: it is how the client removes a line.
        RuleFor(request => request.Quantity).InclusiveBetween(0, 99);
    }
}

public sealed class ApplyCouponRequestValidator : AbstractValidator<ApplyCouponRequest>
{
    public ApplyCouponRequestValidator()
    {
        RuleFor(request => request.Code)
            .NotEmpty()
            .MaximumLength(Coupon.MaxCodeLength)
            // Letters, digits, dash and underscore. A code is typed by hand off
            // a poster; anything else in the box is a mistake or an attempt.
            .Matches("^[A-Za-z0-9_-]+$")
            .WithMessage("A discount code is letters, numbers, - and _ only.");
    }
}
