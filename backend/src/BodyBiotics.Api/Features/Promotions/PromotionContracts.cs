using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Promotions;

/// <summary>
/// What the storefront is allowed to know about a running campaign: the copy
/// for the banner and the shape of the offer. Never the coupon codes — a public
/// endpoint listing them is the shop handing out its own discounts.
/// </summary>
public sealed record PublicPromotionDto(
    string Description,
    string DiscountType,
    int Value,
    int MinSpendMinor,
    DateTimeOffset? EndsAt,
    string? BannerText);

public sealed record StorefrontPromotionsDto(
    IReadOnlyList<PublicPromotionDto> Promotions,
    /// <summary>
    /// The lines for the announcement strip, in priority order. Empty when no
    /// campaign has anything to say, and the storefront falls back to its own
    /// standing copy.
    /// </summary>
    IReadOnlyList<string> Banners,
    int FreeDeliveryThresholdMinor,
    string Currency);

public sealed record AdminCouponDto(
    string Id,
    string Code,
    string Description,
    string DiscountType,
    string Scope,
    string? ScopeSlugs,
    int Value,
    int? MaxDiscountMinor,
    int MinSpendMinor,
    int MinQuantity,
    int BuyQuantity,
    int GetQuantity,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    int? UsageLimit,
    int? UsageLimitPerCustomer,
    int TimesUsed,
    bool Active,
    /// <summary>Whether it would be accepted right now, before looking at a basket.</summary>
    bool IsLive,
    DateTimeOffset CreatedAt)
{
    public static AdminCouponDto From(Coupon coupon) => new(
        coupon.Id,
        coupon.Code,
        coupon.Description,
        coupon.DiscountType.ToString().ToUpperInvariant(),
        coupon.Scope.ToString().ToUpperInvariant(),
        coupon.ScopeSlugs,
        coupon.Value,
        coupon.MaxDiscountMinor,
        coupon.MinSpendMinor,
        coupon.MinQuantity,
        coupon.BuyQuantity,
        coupon.GetQuantity,
        coupon.StartsAt,
        coupon.EndsAt,
        coupon.UsageLimit,
        coupon.UsageLimitPerCustomer,
        coupon.TimesUsed,
        coupon.Active,
        coupon.IsLive(DateTimeOffset.UtcNow),
        coupon.CreatedAt);
}

public sealed record AdminPromotionDto(
    string Id,
    string Name,
    string Description,
    string DiscountType,
    string Scope,
    string? ScopeSlugs,
    int Value,
    int? MaxDiscountMinor,
    int MinSpendMinor,
    int MinQuantity,
    int BuyQuantity,
    int GetQuantity,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    bool Active,
    int Priority,
    bool Stackable,
    string? BannerText,
    bool IsLive,
    DateTimeOffset CreatedAt)
{
    public static AdminPromotionDto From(Promotion promotion) => new(
        promotion.Id,
        promotion.Name,
        promotion.Description,
        promotion.DiscountType.ToString().ToUpperInvariant(),
        promotion.Scope.ToString().ToUpperInvariant(),
        promotion.ScopeSlugs,
        promotion.Value,
        promotion.MaxDiscountMinor,
        promotion.MinSpendMinor,
        promotion.MinQuantity,
        promotion.BuyQuantity,
        promotion.GetQuantity,
        promotion.StartsAt,
        promotion.EndsAt,
        promotion.Active,
        promotion.Priority,
        promotion.Stackable,
        promotion.BannerText,
        promotion.IsLive(DateTimeOffset.UtcNow),
        promotion.CreatedAt);
}

/// <summary>
/// One shape for creating and for editing. Every field but the identifying one
/// is optional on a write, which is what lets staff toggle a campaign off
/// without resending a form that may already be stale.
/// </summary>
public sealed record SaveCouponRequest(
    string Code,
    string Description,
    string DiscountType,
    string Scope,
    string? ScopeSlugs,
    int Value,
    int? MaxDiscountMinor,
    int MinSpendMinor,
    int MinQuantity,
    int BuyQuantity,
    int GetQuantity,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    int? UsageLimit,
    int? UsageLimitPerCustomer,
    bool Active = true);

public sealed record SavePromotionRequest(
    string Name,
    string Description,
    string DiscountType,
    string Scope,
    string? ScopeSlugs,
    int Value,
    int? MaxDiscountMinor,
    int MinSpendMinor,
    int MinQuantity,
    int BuyQuantity,
    int GetQuantity,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    string? BannerText,
    int Priority = 0,
    bool Stackable = true,
    bool Active = true);

/// <summary>
/// The rules a coupon and a promotion share. Written once so the two forms
/// cannot drift into accepting different things.
/// </summary>
internal static class CampaignRules
{
    public static bool IsDiscountType(string? value) =>
        Enum.TryParse<DiscountType>(value, ignoreCase: true, out _);

    public static bool IsScope(string? value) =>
        Enum.TryParse<PromotionScope>(value, ignoreCase: true, out _);

    public static DiscountType ParseDiscountType(string value) =>
        Enum.Parse<DiscountType>(value, ignoreCase: true);

    public static PromotionScope ParseScope(string value) =>
        Enum.Parse<PromotionScope>(value, ignoreCase: true);
}

public sealed class SaveCouponRequestValidator : AbstractValidator<SaveCouponRequest>
{
    public SaveCouponRequestValidator()
    {
        RuleFor(request => request.Code)
            .NotEmpty()
            .MaximumLength(Coupon.MaxCodeLength)
            .Matches("^[A-Za-z0-9_-]+$")
            .WithMessage("A code is letters, numbers, - and _ only.");

        RuleFor(request => request.Description).NotEmpty().MaximumLength(200);

        RuleFor(request => request.DiscountType)
            .Must(CampaignRules.IsDiscountType)
            .WithMessage($"'Discount Type' must be one of: {string.Join(", ", Enum.GetNames<DiscountType>())}.");

        // BuyXGetY is deliberately not offered on a coupon: it is an automatic
        // shelf offer, and expressing it as a code makes a basket priced two
        // different ways depending on whether someone typed something.
        RuleFor(request => request.DiscountType)
            .Must(value => !string.Equals(value, nameof(DiscountType.BuyXGetY), StringComparison.OrdinalIgnoreCase))
            .WithMessage("Buy X get Y is set up as a promotion, not as a code.");

        RuleFor(request => request.Scope)
            .Must(CampaignRules.IsScope)
            .WithMessage($"'Scope' must be one of: {string.Join(", ", Enum.GetNames<PromotionScope>())}.");

        RuleFor(request => request.ScopeSlugs)
            .NotEmpty()
            .When(request => CampaignRules.IsScope(request.Scope)
                && CampaignRules.ParseScope(request.Scope) != PromotionScope.Everything)
            .WithMessage("Choose what this applies to, or set the scope to everything.");

        RuleFor(request => request.ScopeSlugs).MaximumLength(1000);

        RuleFor(request => request.Value)
            .InclusiveBetween(1, 100)
            .When(request => CampaignRules.IsDiscountType(request.DiscountType)
                && CampaignRules.ParseDiscountType(request.DiscountType) == DiscountType.Percentage)
            .WithMessage("A percentage discount is between 1 and 100.");

        RuleFor(request => request.Value)
            .GreaterThan(0)
            .When(request => CampaignRules.IsDiscountType(request.DiscountType)
                && CampaignRules.ParseDiscountType(request.DiscountType) == DiscountType.FixedAmount)
            .WithMessage("A fixed discount must be more than nothing.");

        RuleFor(request => request.MinSpendMinor).GreaterThanOrEqualTo(0);
        RuleFor(request => request.MinQuantity).InclusiveBetween(0, 99);
        RuleFor(request => request.MaxDiscountMinor!.Value)
            .GreaterThan(0)
            .When(request => request.MaxDiscountMinor.HasValue);
        RuleFor(request => request.UsageLimit!.Value)
            .GreaterThan(0)
            .When(request => request.UsageLimit.HasValue);
        RuleFor(request => request.UsageLimitPerCustomer!.Value)
            .GreaterThan(0)
            .When(request => request.UsageLimitPerCustomer.HasValue);

        RuleFor(request => request)
            .Must(request => request.EndsAt!.Value > request.StartsAt!.Value)
            .When(request => request.StartsAt.HasValue && request.EndsAt.HasValue)
            .WithMessage("A campaign cannot end before it starts.");
    }
}

public sealed class SavePromotionRequestValidator : AbstractValidator<SavePromotionRequest>
{
    public SavePromotionRequestValidator()
    {
        RuleFor(request => request.Name).NotEmpty().MaximumLength(120);
        RuleFor(request => request.Description).NotEmpty().MaximumLength(200);
        RuleFor(request => request.BannerText).MaximumLength(200);

        RuleFor(request => request.DiscountType)
            .Must(CampaignRules.IsDiscountType)
            .WithMessage($"'Discount Type' must be one of: {string.Join(", ", Enum.GetNames<DiscountType>())}.");

        RuleFor(request => request.Scope)
            .Must(CampaignRules.IsScope)
            .WithMessage($"'Scope' must be one of: {string.Join(", ", Enum.GetNames<PromotionScope>())}.");

        RuleFor(request => request.ScopeSlugs)
            .NotEmpty()
            .When(request => CampaignRules.IsScope(request.Scope)
                && CampaignRules.ParseScope(request.Scope) != PromotionScope.Everything)
            .WithMessage("Choose what this applies to, or set the scope to everything.");

        RuleFor(request => request.ScopeSlugs).MaximumLength(1000);

        RuleFor(request => request.Value)
            .InclusiveBetween(1, 100)
            .When(request => CampaignRules.IsDiscountType(request.DiscountType)
                && CampaignRules.ParseDiscountType(request.DiscountType) == DiscountType.Percentage)
            .WithMessage("A percentage discount is between 1 and 100.");

        RuleFor(request => request.Value)
            .GreaterThan(0)
            .When(request => CampaignRules.IsDiscountType(request.DiscountType)
                && CampaignRules.ParseDiscountType(request.DiscountType) == DiscountType.FixedAmount)
            .WithMessage("A fixed discount must be more than nothing.");

        // "Buy 0 get 1 free" is the whole shelf given away; "buy 2 get 0" is
        // nothing at all. Both are typos, and both are cheap to catch here.
        RuleFor(request => request.BuyQuantity)
            .InclusiveBetween(1, 20)
            .When(request => CampaignRules.IsDiscountType(request.DiscountType)
                && CampaignRules.ParseDiscountType(request.DiscountType) == DiscountType.BuyXGetY)
            .WithMessage("'Buy Quantity' is between 1 and 20.");

        RuleFor(request => request.GetQuantity)
            .InclusiveBetween(1, 20)
            .When(request => CampaignRules.IsDiscountType(request.DiscountType)
                && CampaignRules.ParseDiscountType(request.DiscountType) == DiscountType.BuyXGetY)
            .WithMessage("'Get Quantity' is between 1 and 20.");

        RuleFor(request => request.MinSpendMinor).GreaterThanOrEqualTo(0);
        RuleFor(request => request.MinQuantity).InclusiveBetween(0, 99);
        RuleFor(request => request.Priority).InclusiveBetween(0, 1000);
        RuleFor(request => request.MaxDiscountMinor!.Value)
            .GreaterThan(0)
            .When(request => request.MaxDiscountMinor.HasValue);

        RuleFor(request => request)
            .Must(request => request.EndsAt!.Value > request.StartsAt!.Value)
            .When(request => request.StartsAt.HasValue && request.EndsAt.HasValue)
            .WithMessage("A campaign cannot end before it starts.");
    }
}
