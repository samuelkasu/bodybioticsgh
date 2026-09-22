using BodyBiotics.Api.Auth;
using BodyBiotics.Api.Http;
using Microsoft.AspNetCore.Mvc;

namespace BodyBiotics.Api.Features.Promotions;

public static class PromotionEndpoints
{
    public static RouteGroupBuilder MapPromotionEndpoints(this RouteGroupBuilder api)
    {
        // Public and cacheable, like the delivery price list: the same answer
        // for everyone, and the storefront's header cannot render without it.
        api.MapGet("/promotions", ListAsync)
            .WithTags("Promotions")
            .WithName("GetPromotions");

        var admin = api
            .MapGroup("/admin")
            .WithTags("Admin")
            .RequireAuthorization(AuthorizationPolicies.Admin);

        admin.MapGet("/promotions", ListPromotionsAsync).WithName("AdminListPromotions");
        admin.MapPost("/promotions", CreatePromotionAsync).WithName("AdminCreatePromotion");
        admin.MapPut("/promotions/{id}", UpdatePromotionAsync).WithName("AdminUpdatePromotion");
        admin.MapDelete("/promotions/{id}", DeletePromotionAsync).WithName("AdminDeletePromotion");

        admin.MapGet("/coupons", ListCouponsAsync).WithName("AdminListCoupons");
        admin.MapPost("/coupons", CreateCouponAsync).WithName("AdminCreateCoupon");
        admin.MapPut("/coupons/{id}", UpdateCouponAsync).WithName("AdminUpdateCoupon");
        admin.MapDelete("/coupons/{id}", DeleteCouponAsync).WithName("AdminDeleteCoupon");

        return api;
    }

    private static async Task<IResult> ListAsync(
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        var result = await promotions.ListForStorefrontAsync(cancellationToken);

        // A campaign that starts on the hour can therefore appear a few minutes
        // late on a cached page. That is the same trade the catalogue already
        // makes, and the cart — which is never cached — prices correctly from
        // the first second regardless.
        CacheHeaders.Catalogue(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> ListPromotionsAsync(
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        var result = await promotions.ListPromotionsAsync(cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> CreatePromotionAsync(
        SavePromotionRequest request,
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        var created = await promotions.CreatePromotionAsync(request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Created(created, $"/api/admin/promotions/{created.Id}");
    }

    private static async Task<IResult> UpdatePromotionAsync(
        string id,
        SavePromotionRequest request,
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        var updated = await promotions.UpdatePromotionAsync(id, request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(updated);
    }

    private static async Task<IResult> DeletePromotionAsync(
        string id,
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        await promotions.DeletePromotionAsync(id, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(new { deleted = true });
    }

    private static async Task<IResult> ListCouponsAsync(
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int perPage = 25)
    {
        var result = await promotions.ListCouponsAsync(search, page, perPage, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(result);
    }

    private static async Task<IResult> CreateCouponAsync(
        SaveCouponRequest request,
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        var created = await promotions.CreateCouponAsync(request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Created(created, $"/api/admin/coupons/{created.Id}");
    }

    private static async Task<IResult> UpdateCouponAsync(
        string id,
        SaveCouponRequest request,
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        var updated = await promotions.UpdateCouponAsync(id, request, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(updated);
    }

    private static async Task<IResult> DeleteCouponAsync(
        string id,
        HttpContext httpContext,
        PromotionService promotions,
        CancellationToken cancellationToken)
    {
        // A used coupon comes back deactivated rather than gone. The client
        // shows whichever it gets.
        var remaining = await promotions.DeleteCouponAsync(id, cancellationToken);

        CacheHeaders.Private(httpContext.Response);
        return ApiResults.Ok(new { deleted = remaining is null, coupon = remaining });
    }
}
