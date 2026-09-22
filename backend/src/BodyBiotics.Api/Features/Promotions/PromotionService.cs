using BodyBiotics.Api.Features.Products;
using BodyBiotics.Api.Http;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using FluentValidation;

namespace BodyBiotics.Api.Features.Promotions;

/// <summary>
/// Campaign management. The read half is public and says nothing a customer
/// could not already work out from the shop; the write half is reachable only
/// through the admin policy.
/// </summary>
public sealed class PromotionService(
    IPromotionRepository promotions,
    IValidator<SaveCouponRequest> couponValidator,
    IValidator<SavePromotionRequest> promotionValidator)
{
    public const int MaxPerPage = 100;

    /// <summary>
    /// What is running, for the storefront's banner and any "offers" page.
    /// Coupons are not in here on purpose — they are earned, not advertised in
    /// a JSON endpoint anyone can curl.
    /// </summary>
    public async Task<StorefrontPromotionsDto> ListForStorefrontAsync(
        CancellationToken cancellationToken)
    {
        var live = await promotions.ListLiveAsync(DateTimeOffset.UtcNow, cancellationToken);

        return new StorefrontPromotionsDto(
            [
                .. live.Select(promotion => new PublicPromotionDto(
                    promotion.Description,
                    promotion.DiscountType.ToString().ToUpperInvariant(),
                    promotion.Value,
                    promotion.MinSpendMinor,
                    promotion.EndsAt,
                    promotion.BannerText)),
            ],
            [
                .. live
                    .Where(promotion => !string.IsNullOrWhiteSpace(promotion.BannerText))
                    .Select(promotion => promotion.BannerText!),
            ],
            DeliveryZones.FreeDeliveryThresholdMinor,
            Money.DefaultCurrency);
    }

    public async Task<IReadOnlyList<AdminPromotionDto>> ListPromotionsAsync(
        CancellationToken cancellationToken)
    {
        var all = await promotions.ListAllAsync(cancellationToken);
        return [.. all.Select(AdminPromotionDto.From)];
    }

    public async Task<AdminPromotionDto> CreatePromotionAsync(
        SavePromotionRequest request,
        CancellationToken cancellationToken)
    {
        await promotionValidator.ValidateAndThrowAsync(request, cancellationToken);

        var promotion = new Promotion
        {
            Id = Identifier.New(),
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
        };

        ApplyTo(promotion, request);

        promotions.Add(promotion);
        await promotions.SaveChangesAsync(cancellationToken);

        return AdminPromotionDto.From(promotion);
    }

    public async Task<AdminPromotionDto> UpdatePromotionAsync(
        string id,
        SavePromotionRequest request,
        CancellationToken cancellationToken)
    {
        await promotionValidator.ValidateAndThrowAsync(request, cancellationToken);

        var promotion = await promotions.FindPromotionAsync(id, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, "No such promotion");

        promotion.Name = request.Name.Trim();
        promotion.Description = request.Description.Trim();
        ApplyTo(promotion, request);
        promotion.UpdatedAt = DateTimeOffset.UtcNow;

        await promotions.SaveChangesAsync(cancellationToken);
        return AdminPromotionDto.From(promotion);
    }

    public async Task DeletePromotionAsync(string id, CancellationToken cancellationToken)
    {
        var promotion = await promotions.FindPromotionAsync(id, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, "No such promotion");

        promotions.Remove(promotion);
        await promotions.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedDto<AdminCouponDto>> ListCouponsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken)
    {
        var result = await promotions.ListCouponsAsync(
            search,
            Math.Max(1, page),
            Math.Clamp(perPage, 1, MaxPerPage),
            cancellationToken);

        return new PagedDto<AdminCouponDto>(
            [.. result.Items.Select(AdminCouponDto.From)],
            result.Page,
            result.PerPage,
            result.Total);
    }

    public async Task<AdminCouponDto> CreateCouponAsync(
        SaveCouponRequest request,
        CancellationToken cancellationToken)
    {
        await couponValidator.ValidateAndThrowAsync(request, cancellationToken);

        var code = Coupon.Normalise(request.Code);

        // Checked here for a readable message; the unique index is what
        // actually guarantees it against two admins saving at once.
        if (await promotions.FindCouponAsync(code, cancellationToken) is not null)
        {
            throw new ApiException(ApiErrorCode.Conflict, $"The code {code} already exists.");
        }

        var coupon = new Coupon
        {
            Id = Identifier.New(),
            Code = code,
            Description = request.Description.Trim(),
        };

        ApplyTo(coupon, request);

        promotions.Add(coupon);
        await promotions.SaveChangesAsync(cancellationToken);

        return AdminCouponDto.From(coupon);
    }

    public async Task<AdminCouponDto> UpdateCouponAsync(
        string id,
        SaveCouponRequest request,
        CancellationToken cancellationToken)
    {
        await couponValidator.ValidateAndThrowAsync(request, cancellationToken);

        var coupon = await promotions.FindCouponByIdAsync(id, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, "No such coupon");

        var code = Coupon.Normalise(request.Code);

        if (!string.Equals(code, coupon.Code, StringComparison.Ordinal))
        {
            var clash = await promotions.FindCouponAsync(code, cancellationToken);
            if (clash is not null && clash.Id != coupon.Id)
            {
                throw new ApiException(ApiErrorCode.Conflict, $"The code {code} already exists.");
            }

            coupon.Code = code;
        }

        coupon.Description = request.Description.Trim();
        ApplyTo(coupon, request);
        coupon.UpdatedAt = DateTimeOffset.UtcNow;

        await promotions.SaveChangesAsync(cancellationToken);
        return AdminCouponDto.From(coupon);
    }

    /// <summary>
    /// Deletes a coupon that has never been used. One that has is deactivated
    /// instead: its redemptions point at real orders, and taking the row away
    /// would either cascade those away or fail on the constraint.
    /// </summary>
    public async Task<AdminCouponDto?> DeleteCouponAsync(
        string id,
        CancellationToken cancellationToken)
    {
        var coupon = await promotions.FindCouponByIdAsync(id, cancellationToken)
            ?? throw new ApiException(ApiErrorCode.NotFound, "No such coupon");

        if (coupon.TimesUsed > 0)
        {
            coupon.Active = false;
            coupon.UpdatedAt = DateTimeOffset.UtcNow;
            await promotions.SaveChangesAsync(cancellationToken);
            return AdminCouponDto.From(coupon);
        }

        promotions.Remove(coupon);
        await promotions.SaveChangesAsync(cancellationToken);
        return null;
    }

    private static void ApplyTo(Coupon coupon, SaveCouponRequest request)
    {
        coupon.DiscountType = CampaignRules.ParseDiscountType(request.DiscountType);
        coupon.Scope = CampaignRules.ParseScope(request.Scope);
        coupon.ScopeSlugs = Normalise(request.ScopeSlugs);
        coupon.Value = request.Value;
        coupon.MaxDiscountMinor = request.MaxDiscountMinor;
        coupon.MinSpendMinor = request.MinSpendMinor;
        coupon.MinQuantity = request.MinQuantity;
        coupon.BuyQuantity = request.BuyQuantity;
        coupon.GetQuantity = request.GetQuantity;
        coupon.StartsAt = request.StartsAt;
        coupon.EndsAt = request.EndsAt;
        coupon.UsageLimit = request.UsageLimit;
        coupon.UsageLimitPerCustomer = request.UsageLimitPerCustomer;
        coupon.Active = request.Active;
    }

    private static void ApplyTo(Promotion promotion, SavePromotionRequest request)
    {
        promotion.DiscountType = CampaignRules.ParseDiscountType(request.DiscountType);
        promotion.Scope = CampaignRules.ParseScope(request.Scope);
        promotion.ScopeSlugs = Normalise(request.ScopeSlugs);
        promotion.Value = request.Value;
        promotion.MaxDiscountMinor = request.MaxDiscountMinor;
        promotion.MinSpendMinor = request.MinSpendMinor;
        promotion.MinQuantity = request.MinQuantity;
        promotion.BuyQuantity = request.BuyQuantity;
        promotion.GetQuantity = request.GetQuantity;
        promotion.StartsAt = request.StartsAt;
        promotion.EndsAt = request.EndsAt;
        promotion.BannerText = string.IsNullOrWhiteSpace(request.BannerText)
            ? null
            : request.BannerText.Trim();
        promotion.Priority = request.Priority;
        promotion.Stackable = request.Stackable;
        promotion.Active = request.Active;
    }

    /// <summary>
    /// Tidies a pasted slug list. Staff type these with stray spaces and
    /// trailing commas, and the matcher would otherwise be looking for a slug
    /// called " cerave".
    /// </summary>
    private static string? Normalise(string? slugs) =>
        string.IsNullOrWhiteSpace(slugs)
            ? null
            : string.Join(
                ',',
                slugs.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}
